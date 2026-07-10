import {
  type FinalSynthesis,
  FinalSynthesisJsonSchema,
  FinalSynthesisSchema,
  type ModelOutput,
  ModelOutputSchema,
  type ProviderDescriptor,
  ProviderDescriptorSchema,
} from "../schemas.ts";
import type { ModelAdapter, SynthesisAdapter } from "../contracts.ts";
import {
  BudgetManager,
  CircuitBreaker,
  type CircuitBreakerOptions,
  type RetryPolicy,
} from "../budget/budget.ts";
import {
  credentialValuesFromEnv,
  errorMessage,
  failClosed,
  ProcessExecutionError,
  sanitizeDiagnosticText,
} from "../errors.ts";
import { sleepWithAbort } from "../utils.ts";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function secureTempFilePath(tmpDir: string, suffix: string): string {
  return `${tmpDir}/${crypto.randomUUID()}-${suffix}`;
}

async function writeRestrictiveTextFile(
  path: string,
  content: string,
): Promise<void> {
  await Deno.writeTextFile(path, content, { mode: 0o600 });
  // Deno's create-time mode is subject to the host umask and platform support.
  // Tighten permissions best-effort on POSIX while keeping Windows/unsupported
  // filesystems from breaking the adapter path.
  await Deno.chmod(path, 0o600).catch(() => undefined);
}

export type ProcessInvocation = {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  stdin?: string;
  timeoutMs?: number;
};

export type ProcessExecutionResult = {
  code: number;
  stdout: string;
  stderr: string;
  durationMs: number;
};

export type AuthStrategy = {
  env?: Record<string, string>;
  readinessCheck?: ProcessInvocation | (() => ProcessInvocation);
  refreshCommand?: ProcessInvocation | (() => ProcessInvocation);
};

export type ModelOutputParser = (
  result: ProcessExecutionResult,
  descriptor: ProviderDescriptor,
) => ModelOutput;

export type ProcessModelAdapterOptions = {
  descriptor: ProviderDescriptor;
  buildInvocation: (prompt: string) => ProcessInvocation;
  parseOutput?: ModelOutputParser;
  auth?: AuthStrategy;
  retryPolicy?: RetryPolicy;
  circuitBreaker?: CircuitBreakerOptions;
  budgetManager?: BudgetManager;
  estimatedCostUsd?: number;
  defaultTimeoutMs?: number;
};

function resolveInvocation(
  invocation: ProcessInvocation | (() => ProcessInvocation),
): ProcessInvocation {
  return typeof invocation === "function" ? invocation() : invocation;
}

function mergeEnv(
  base: Record<string, string> | undefined,
  extra: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!base && !extra) {
    return undefined;
  }

  return {
    ...(base ?? {}),
    ...(extra ?? {}),
  };
}

export function repoLocalBin(name: string): string {
  return `${Deno.cwd()}/bin/${name}`;
}

export function extractRetryAfterMs(text: string): number | undefined {
  const retryAfterMatch = text.match(/retry[- ]after[:= ]+(\d+(?:\.\d+)?)s?/i);
  if (retryAfterMatch) {
    return Math.ceil(Number(retryAfterMatch[1]) * 1000);
  }

  return undefined;
}

export function classifyProcessFailure(
  message: string,
  stdout: string,
  stderr: string,
  exitCode?: number,
  redactionValues: string[] = [],
): ProcessExecutionError {
  const haystack = `${message}
${stdout}
${stderr}`.toLowerCase();
  const retryAfterMs = extractRetryAfterMs(`${stdout}
${stderr}`);
  const safeMessage = sanitizeDiagnosticText(message, redactionValues);
  const safeStdout = sanitizeDiagnosticText(stdout, redactionValues);
  const safeStderr = sanitizeDiagnosticText(stderr, redactionValues);
  const options = {
    exitCode,
    stdout: safeStdout,
    stderr: safeStderr,
    retryAfterMs,
    redactionValues,
  };

  if (haystack.includes("timed out")) {
    return new ProcessExecutionError("timeout", safeMessage, options);
  }

  if (
    haystack.includes("unauthorized") ||
    haystack.includes("forbidden") ||
    haystack.includes("permission denied") ||
    haystack.includes("permission_denied") ||
    haystack.includes("reported as leaked") ||
    haystack.includes("organization has disabled") ||
    haystack.includes("ask your admin to enable access") ||
    haystack.includes("auth required") ||
    haystack.includes("must select an auth method")
  ) {
    return new ProcessExecutionError("auth_failed", safeMessage, options);
  }

  if (
    haystack.includes("model config is missing") ||
    haystack.includes("explicit model provider")
  ) {
    return new ProcessExecutionError(
      "wrapper_config_missing",
      safeMessage,
      options,
    );
  }

  if (
    haystack.includes("rate limit") ||
    haystack.includes("429") ||
    haystack.includes("too many requests")
  ) {
    return new ProcessExecutionError("rate_limited", safeMessage, options);
  }

  if (
    haystack.includes("not found") ||
    haystack.includes("no such file or directory")
  ) {
    return new ProcessExecutionError(
      "command_unavailable",
      safeMessage,
      options,
    );
  }

  return new ProcessExecutionError("process_failed", safeMessage, options);
}

export function isRetriableError(error: unknown): boolean {
  if (error instanceof ProcessExecutionError) {
    return ["rate_limited", "timeout", "process_failed"].includes(
      error.codeName,
    );
  }

  return false;
}

export function shouldCountTowardsCircuitBreaker(error: unknown): boolean {
  if (!(error instanceof ProcessExecutionError)) {
    return true;
  }

  return [
    "rate_limited",
    "timeout",
    "process_failed",
    "provider_malformed",
  ].includes(error.codeName);
}

export function backoffDelayMs(
  attempt: number,
  policy: RetryPolicy,
  error: unknown,
): number {
  if (
    error instanceof ProcessExecutionError && error.retryAfterMs !== undefined
  ) {
    return Math.min(error.retryAfterMs, policy.maxDelayMs);
  }

  return Math.min(policy.baseDelayMs * 2 ** (attempt - 1), policy.maxDelayMs);
}

async function runProcess(
  invocation: ProcessInvocation,
  signal: AbortSignal,
  label: string,
  defaultTimeoutMs: number,
): Promise<ProcessExecutionResult> {
  const startedAt = Date.now();
  const timeoutMs = invocation.timeoutMs ?? defaultTimeoutMs;
  const redactionValues = credentialValuesFromEnv(invocation.env);

  let child: Deno.ChildProcess | undefined;
  let aborted = false;
  let timedOut = false;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let killTimeoutId: ReturnType<typeof setTimeout> | undefined;
  let rejectEarly: ((error: ProcessExecutionError) => void) | undefined;

  const terminate = (
    kind: "timeout" | "aborted",
    message: string,
    details?: Record<string, unknown>,
  ) => {
    if (kind === "timeout") {
      timedOut = true;
    } else {
      aborted = true;
    }

    try {
      child?.kill("SIGTERM");
    } catch {
      // best effort
    }

    killTimeoutId = setTimeout(() => {
      try {
        child?.kill("SIGKILL");
      } catch {
        // best effort
      }
    }, 1_000);

    rejectEarly?.(new ProcessExecutionError(kind, message, details));
  };

  const onAbort = () => {
    terminate("aborted", `${label} was aborted.`, { redactionValues });
  };

  try {
    signal.addEventListener("abort", onAbort, { once: true });

    const command = new Deno.Command(invocation.command, {
      args: invocation.args ?? [],
      cwd: invocation.cwd,
      env: invocation.env,
      stdin: invocation.stdin !== undefined ? "piped" : "null",
      stdout: "piped",
      stderr: "piped",
    });

    child = command.spawn();

    const earlyExit = new Promise<never>((_, reject) => {
      rejectEarly = reject;
    });

    timeoutId = setTimeout(() => {
      terminate(
        "timeout",
        `${label} timed out after ${timeoutMs}ms.`,
        { redactionValues },
      );
    }, timeoutMs);

    const stdinPromise = (async () => {
      if (invocation.stdin === undefined || !child?.stdin) {
        return;
      }

      const writer = child.stdin.getWriter();
      try {
        await writer.write(encoder.encode(invocation.stdin));
      } finally {
        await writer.close();
      }
    })().catch((error) => {
      if (timedOut || aborted || signal.aborted) {
        return;
      }
      throw error;
    });

    const outputPromise = child.output();
    const { code, stdout, stderr } = await Promise.race([
      outputPromise,
      earlyExit,
    ]);
    await stdinPromise;

    const stdoutText = decoder.decode(stdout);
    const stderrText = decoder.decode(stderr);

    if (timedOut) {
      throw new ProcessExecutionError(
        "timeout",
        `${label} timed out after ${timeoutMs}ms.`,
        {
          exitCode: code,
          stdout: stdoutText,
          stderr: stderrText,
          redactionValues,
        },
      );
    }

    if (aborted || signal.aborted) {
      throw new ProcessExecutionError("aborted", `${label} was aborted.`, {
        exitCode: code,
        stdout: stdoutText,
        stderr: stderrText,
        redactionValues,
      });
    }

    if (code !== 0) {
      throw classifyProcessFailure(
        `${label} exited with status ${code}.`,
        stdoutText,
        stderrText,
        code,
        redactionValues,
      );
    }

    return {
      code,
      stdout: sanitizeDiagnosticText(stdoutText, redactionValues),
      stderr: sanitizeDiagnosticText(stderrText, redactionValues),
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    if (error instanceof ProcessExecutionError) {
      throw error;
    }

    if (error instanceof Deno.errors.NotFound) {
      throw new ProcessExecutionError(
        "command_unavailable",
        `${label} command not found: ${invocation.command}`,
        { cause: error },
      );
    }

    throw classifyProcessFailure(errorMessage(error), "", "", undefined);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
    if (typeof killTimeoutId === "number") {
      clearTimeout(killTimeoutId);
    }
    signal.removeEventListener("abort", onAbort);
  }
}

export function parsePlainTextModelOutput(
  result: ProcessExecutionResult,
  descriptor: ProviderDescriptor,
): ModelOutput {
  const content = result.stdout.trim();

  if (descriptor.transport === "zcodeWrapper" && content.startsWith("Error:")) {
    throw classifyProcessFailure(
      content,
      result.stdout,
      result.stderr,
      result.code,
    );
  }

  if (!content) {
    throw new ProcessExecutionError(
      "provider_malformed",
      `${descriptor.provider}/${descriptor.model} returned empty stdout.`,
      {
        stdout: result.stdout,
        stderr: result.stderr,
      },
    );
  }

  return ModelOutputSchema.parse({
    content,
    model: descriptor.model,
    provider: descriptor.provider,
    latencyMs: result.durationMs,
  });
}

function extractJsonObjects(text: string): unknown[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("{") && line.endsWith("}"))
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
}

export function parseCodexJsonlOutput(
  result: ProcessExecutionResult,
  descriptor: ProviderDescriptor,
): ModelOutput {
  const objects = extractJsonObjects(result.stdout);

  for (const obj of objects) {
    if (
      typeof obj === "object" &&
      obj !== null &&
      "item" in obj &&
      typeof (obj as { item?: { type?: string; text?: string } }).item?.text ===
        "string"
    ) {
      const item = (obj as { item: { type?: string; text: string } }).item;
      if (item.type === "agent_message") {
        return ModelOutputSchema.parse({
          content: item.text.trim(),
          model: descriptor.model,
          provider: descriptor.provider,
          latencyMs: result.durationMs,
        });
      }
    }
  }

  return parsePlainTextModelOutput(result, descriptor);
}

export function parseClineJsonlOutput(
  result: ProcessExecutionResult,
  descriptor: ProviderDescriptor,
): ModelOutput {
  const objects = extractJsonObjects(result.stdout);

  for (const obj of objects.reverse()) {
    if (
      typeof obj === "object" &&
      obj !== null &&
      "type" in obj &&
      (obj as { type?: string }).type === "run_result"
    ) {
      const runResult = obj as { text?: string };
      if (typeof runResult.text === "string" && runResult.text.trim()) {
        return ModelOutputSchema.parse({
          content: runResult.text.trim(),
          model: descriptor.model,
          provider: descriptor.provider,
          latencyMs: result.durationMs,
        });
      }
    }
  }

  return parsePlainTextModelOutput(result, descriptor);
}

async function ensureAuthReady(
  auth: AuthStrategy | undefined,
  signal: AbortSignal,
  label: string,
  defaultTimeoutMs: number,
): Promise<void> {
  if (!auth) {
    return;
  }

  const attemptReadinessCheck = async (): Promise<void> => {
    if (!auth.readinessCheck) {
      return;
    }

    const readinessCheck = resolveInvocation(auth.readinessCheck);
    await runProcess(
      {
        ...readinessCheck,
        env: mergeEnv(auth.env, readinessCheck.env),
      },
      signal,
      `${label} auth readiness check`,
      defaultTimeoutMs,
    );
  };

  try {
    await attemptReadinessCheck();
  } catch (error) {
    if (!auth.refreshCommand) {
      throw error;
    }

    const refreshCommand = resolveInvocation(auth.refreshCommand);
    await runProcess(
      {
        ...refreshCommand,
        env: mergeEnv(auth.env, refreshCommand.env),
      },
      signal,
      `${label} auth refresh`,
      defaultTimeoutMs,
    );

    await attemptReadinessCheck();
  }
}

class ProcessModelAdapter implements ModelAdapter {
  readonly descriptor: ProviderDescriptor;
  private readonly buildInvocation: (prompt: string) => ProcessInvocation;
  private readonly parseOutput: ModelOutputParser;
  private readonly auth?: AuthStrategy;
  private readonly retryPolicy: RetryPolicy;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly budgetManager?: BudgetManager;
  private readonly estimatedCostUsd: number;
  private readonly defaultTimeoutMs: number;

  constructor(options: ProcessModelAdapterOptions) {
    this.descriptor = ProviderDescriptorSchema.parse(options.descriptor);
    this.buildInvocation = options.buildInvocation;
    this.parseOutput = options.parseOutput ?? parsePlainTextModelOutput;
    this.auth = options.auth;
    this.retryPolicy = options.retryPolicy ?? {
      maxAttempts: 2,
      baseDelayMs: 400,
      maxDelayMs: 5_000,
    };
    this.circuitBreaker = new CircuitBreaker(
      options.circuitBreaker ?? {
        failureThreshold: 3,
        cooldownMs: 15_000,
      },
    );
    this.budgetManager = options.budgetManager;
    this.estimatedCostUsd = options.estimatedCostUsd ?? 0;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 60_000;

    if (
      !Number.isInteger(this.retryPolicy.maxAttempts) ||
      this.retryPolicy.maxAttempts < 1
    ) {
      throw new Error("retryPolicy.maxAttempts must be an integer >= 1.");
    }
    if (this.retryPolicy.baseDelayMs < 0 || this.retryPolicy.maxDelayMs < 0) {
      throw new Error("retryPolicy delays must be >= 0.");
    }
  }

  async invoke(prompt: string, signal: AbortSignal): Promise<ModelOutput> {
    const label = `${this.descriptor.provider}/${this.descriptor.model}`;
    this.circuitBreaker.assertAvailable(label);

    let lastError: unknown;
    let budgetReserved = false;

    for (
      let attempt = 1;
      attempt <= this.retryPolicy.maxAttempts;
      attempt += 1
    ) {
      try {
        await ensureAuthReady(this.auth, signal, label, this.defaultTimeoutMs);

        if (
          !budgetReserved && this.estimatedCostUsd > 0 && this.budgetManager
        ) {
          this.budgetManager.consume(label, this.estimatedCostUsd);
          budgetReserved = true;
        }

        const invocation = this.buildInvocation(prompt);
        const result = await runProcess(
          {
            ...invocation,
            env: mergeEnv(this.auth?.env, invocation.env),
          },
          signal,
          label,
          this.defaultTimeoutMs,
        );

        const parsed = this.parseOutput(result, this.descriptor);
        this.circuitBreaker.recordSuccess();
        return ModelOutputSchema.parse(parsed);
      } catch (error) {
        lastError = error;

        if (shouldCountTowardsCircuitBreaker(error)) {
          this.circuitBreaker.recordFailure();
        }

        if (
          !isRetriableError(error) || attempt >= this.retryPolicy.maxAttempts
        ) {
          break;
        }

        const delayMs = backoffDelayMs(attempt, this.retryPolicy, error);
        await sleepWithAbort(delayMs, signal);
      }
    }

    throw lastError;
  }
}

export function createProcessAdapter(
  options: ProcessModelAdapterOptions,
): ModelAdapter {
  return new ProcessModelAdapter(options);
}

export type CodexCliAdapterOptions = {
  model?: string;
  command?: string;
  budgetManager?: BudgetManager;
  auth?: AuthStrategy;
};

export function createCodexCliAdapter(
  options: CodexCliAdapterOptions = {},
): ModelAdapter {
  const command = options.command ?? repoLocalBin("codex-headless");

  return createProcessAdapter({
    descriptor: {
      provider: "OpenAI",
      model: options.model ?? "codex",
      authMode: "oauth",
      transport: "processAdapter",
      client: "CodexCLI",
    },
    parseOutput: parseCodexJsonlOutput,
    budgetManager: options.budgetManager,
    estimatedCostUsd: 0.03,
    auth: options.auth ?? {
      readinessCheck: {
        command,
        args: ["status"],
      },
    },
    buildInvocation: (prompt) => ({
      command,
      args: [
        "exec",
        "--skip-git-repo-check",
        "--sandbox",
        "read-only",
        "--json",
        prompt,
      ],
    }),
  });
}

export type ClaudeCodeAdapterOptions = {
  command?: string;
  budgetManager?: BudgetManager;
  auth?: AuthStrategy;
};

export function createClaudeCodeAdapter(
  options: ClaudeCodeAdapterOptions = {},
): ModelAdapter {
  const command = options.command ?? repoLocalBin("claude-headless");

  return createProcessAdapter({
    descriptor: {
      provider: "Anthropic",
      model: "claude-code",
      authMode: "oauth",
      transport: "processAdapter",
      client: "ClaudeCode",
    },
    estimatedCostUsd: 0.04,
    budgetManager: options.budgetManager,
    auth: options.auth ?? {
      readinessCheck: {
        command,
        args: ["status"],
      },
    },
    buildInvocation: (prompt) => ({
      command,
      args: ["-p", prompt, "--output-format", "text"],
    }),
  });
}

export type GeminiCliAdapterOptions = {
  command?: string;
  budgetManager?: BudgetManager;
  auth?: AuthStrategy;
};

export function createGeminiCliAdapter(
  options: GeminiCliAdapterOptions = {},
): ModelAdapter {
  const command = options.command ?? repoLocalBin("gemini-headless");

  return createProcessAdapter({
    descriptor: {
      provider: "Google",
      model: "gemini-cli",
      authMode: "oauth",
      transport: "processAdapter",
      client: "GeminiCLI",
    },
    estimatedCostUsd: 0.02,
    budgetManager: options.budgetManager,
    auth: options.auth ?? {
      readinessCheck: {
        command,
        args: ["status"],
      },
    },
    buildInvocation: (prompt) => ({
      command,
      args: [
        "-p",
        prompt,
        "--output-format",
        "text",
        "--approval-mode",
        "plan",
        "--skip-trust",
      ],
    }),
  });
}

export type GrokCliAdapterOptions = {
  command?: string;
  budgetManager?: BudgetManager;
  auth?: AuthStrategy;
};

export function createGrokCliAdapter(
  options: GrokCliAdapterOptions = {},
): ModelAdapter {
  const command = options.command ?? repoLocalBin("grok-headless");

  return createProcessAdapter({
    descriptor: {
      provider: "xAI",
      model: "grok",
      authMode: "oauth",
      transport: "processAdapter",
      client: "GrokCLI",
    },
    estimatedCostUsd: 0.03,
    budgetManager: options.budgetManager,
    auth: options.auth ?? {
      readinessCheck: {
        command,
        args: ["status"],
      },
    },
    buildInvocation: (prompt) => ({
      command,
      args: [
        "-p",
        prompt,
        "--output-format",
        "plain",
        "--permission-mode",
        "plan",
        "--disable-web-search",
      ],
    }),
  });
}

export type DevinCliAdapterOptions = {
  command?: string;
  budgetManager?: BudgetManager;
  auth?: AuthStrategy;
};

export function createDevinCliAdapter(
  options: DevinCliAdapterOptions = {},
): ModelAdapter {
  return createProcessAdapter({
    descriptor: {
      provider: "Cognition",
      model: "devin",
      authMode: "session",
      transport: "processAdapter",
      client: "DevinCLI",
    },
    estimatedCostUsd: 0.05,
    budgetManager: options.budgetManager,
    auth: options.auth ?? {
      readinessCheck: {
        command: options.command ?? "devin",
        args: ["auth", "status"],
      },
    },
    buildInvocation: (prompt) => ({
      command: options.command ?? "devin",
      args: ["-p", prompt],
    }),
  });
}

export type ClineCliAdapterOptions = {
  command?: string;
  budgetManager?: BudgetManager;
  auth?: AuthStrategy;
};

export function createClineCliAdapter(
  options: ClineCliAdapterOptions = {},
): ModelAdapter {
  return createProcessAdapter({
    descriptor: {
      provider: "Cline",
      model: "cline",
      authMode: "session",
      transport: "processAdapter",
      client: "Cline",
    },
    estimatedCostUsd: 0.03,
    budgetManager: options.budgetManager,
    auth: options.auth,
    parseOutput: parseClineJsonlOutput,
    buildInvocation: (prompt) => ({
      command: options.command ?? "cline",
      args: [
        "--json",
        "--timeout",
        "60",
        "--thinking",
        "low",
        "--auto-approve",
        "true",
        prompt,
      ],
    }),
  });
}

export type ZcodeAdapterOptions = {
  model?: string;
  command?: string;
  budgetManager?: BudgetManager;
  auth?: AuthStrategy;
  buildInvocation?: (prompt: string, command: string) => ProcessInvocation;
};

export function createZcodeGlmAdapter(
  options: ZcodeAdapterOptions = {},
): ModelAdapter {
  const command = options.command ?? repoLocalBin("zcode-headless");

  return createProcessAdapter({
    descriptor: {
      provider: "GLM",
      model: options.model ?? "glm-zcode",
      authMode: "oauth",
      transport: "zcodeWrapper",
      client: "zcode",
    },
    budgetManager: options.budgetManager,
    estimatedCostUsd: 0.02,
    auth: options.auth ?? {
      readinessCheck: {
        command,
        args: ["doctor"],
      },
    },
    buildInvocation: (prompt) => {
      if (!options.buildInvocation) {
        return {
          command,
          args: [
            "--cwd",
            Deno.cwd(),
            "--mode",
            "plan",
            "--prompt",
            prompt,
          ],
        };
      }

      return options.buildInvocation(prompt, command);
    },
  });
}

export type CodexSynthesisAdapterOptions = {
  model?: string;
  command?: string;
  budgetManager?: BudgetManager;
  auth?: AuthStrategy;
  defaultTimeoutMs?: number;
};

export class CodexStructuredSynthesisAdapter implements SynthesisAdapter {
  readonly descriptor: ProviderDescriptor;
  private readonly command: string;
  private readonly budgetManager?: BudgetManager;
  private readonly auth?: AuthStrategy;
  private readonly defaultTimeoutMs: number;

  constructor(options: CodexSynthesisAdapterOptions = {}) {
    const command = options.command ?? repoLocalBin("codex-headless");

    this.descriptor = ProviderDescriptorSchema.parse({
      provider: "OpenAI",
      model: options.model ?? "gpt-5.5",
      authMode: "oauth",
      transport: "processAdapter",
      client: "CodexCLI",
    });
    this.command = command;
    this.budgetManager = options.budgetManager;
    this.auth = options.auth ?? {
      readinessCheck: {
        command,
        args: ["status"],
      },
    };
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 90_000;
  }

  async synthesize(
    prompt: string,
    outputs: ModelOutput[],
    signal: AbortSignal,
  ): Promise<FinalSynthesis> {
    const label = `${this.descriptor.provider}/${this.descriptor.model}`;
    await ensureAuthReady(this.auth, signal, label, this.defaultTimeoutMs);

    if (this.budgetManager) {
      this.budgetManager.consume(label, 0.05);
    }

    const tmpDir = await Deno.makeTempDir({ prefix: "quorum-router-codex-" });
    const schemaPath = secureTempFilePath(tmpDir, "schema.json");
    const outputPath = secureTempFilePath(tmpDir, "out.json");

    try {
      await writeRestrictiveTextFile(
        schemaPath,
        JSON.stringify(FinalSynthesisJsonSchema, null, 2),
      );
      await writeRestrictiveTextFile(outputPath, "");

      const sourceLines = outputs
        .map((output, index) =>
          `${index + 1}. [${output.provider}/${output.model}] ${output.content}`
        )
        .join("\n");

      const synthesisPrompt = [
        "You are the consensus stage of a fail-closed quorum router.",
        "Return only a JSON object matching the provided schema.",
        `Original user prompt: ${prompt}`,
        "Validated upstream outputs:",
        sourceLines,
        `Set consensusModel to ${this.descriptor.provider}/${this.descriptor.model}.`,
        "Set sources to the list of contributing provider/model labels.",
      ].join("\n\n");

      await runProcess(
        {
          command: this.command,
          args: [
            "exec",
            "--skip-git-repo-check",
            "--sandbox",
            "read-only",
            "--output-schema",
            schemaPath,
            "--output-last-message",
            outputPath,
            synthesisPrompt,
          ],
          env: this.auth?.env,
        },
        signal,
        label,
        this.defaultTimeoutMs,
      );

      const raw = await Deno.readTextFile(outputPath);
      return FinalSynthesisSchema.parse(JSON.parse(raw));
    } catch (error) {
      failClosed(
        4401,
        "consensus_validation_failed",
        "Consensus stage failed validation.",
        {
          cause: errorMessage(error),
        },
      );
    } finally {
      await Deno.remove(tmpDir, { recursive: true }).catch(() => undefined);
    }
  }
}

export function createCodexStructuredSynthesisAdapter(
  options: CodexSynthesisAdapterOptions = {},
): SynthesisAdapter {
  return new CodexStructuredSynthesisAdapter(options);
}
