import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

/**
 * Fusion Router
 *
 * Real process-backed adapters for CLI / wrapper surfaces.
 *
 * Current adapter families:
 * - OpenAI via Codex CLI
 * - Anthropic via Claude Code
 * - xAI via Grok CLI
 * - Google via Gemini CLI
 * - GLM via zcode wrapper
 * - Cognition via Devin CLI
 * - Cline via Cline CLI
 *
 * The router still validates every upstream output with Zod, fails closed when
 * quorum is not met, emits co-failure telemetry, and runs a structured
 * synthesis step through Codex CLI.
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const AuthModeSchema = z.enum(["apiKey", "oauth", "session"]);
const TransportSchema = z.enum(["zcodeWrapper", "processAdapter"]);

const ProviderDescriptorSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  authMode: AuthModeSchema,
  transport: TransportSchema,
  client: z.string().min(1).optional(),
});

export type ProviderDescriptor = z.infer<typeof ProviderDescriptorSchema>;

export const ModelOutputSchema = z.object({
  content: z.string().min(1),
  model: z.string().min(1),
  provider: z.string().min(1),
  latencyMs: z.number().nonnegative(),
});

export type ModelOutput = z.infer<typeof ModelOutputSchema>;

export const FinalSynthesisSchema = z.object({
  synthesis: z.string().min(1),
  reasoning: z.string().min(1),
  consensusModel: z.string().min(1),
  sources: z.array(z.string().min(1)).min(1),
});

const FinalSynthesisJsonSchema = {
  type: "object",
  properties: {
    synthesis: { type: "string", minLength: 1 },
    reasoning: { type: "string", minLength: 1 },
    consensusModel: { type: "string", minLength: 1 },
    sources: {
      type: "array",
      items: { type: "string", minLength: 1 },
      minItems: 1,
    },
  },
  required: ["synthesis", "reasoning", "consensusModel", "sources"],
  additionalProperties: false,
} as const;

export type FinalSynthesis = z.infer<typeof FinalSynthesisSchema>;

const TelemetryFailureSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  code: z.string().min(1),
  message: z.string().min(1),
});

export type TelemetryFailure = z.infer<typeof TelemetryFailureSchema>;

export const CoFailureTelemetrySchema = z.object({
  totalAdapters: z.number().int().nonnegative(),
  successfulAdapters: z.number().int().nonnegative(),
  failedAdapters: z.number().int().nonnegative(),
  failures: z.array(TelemetryFailureSchema),
});

export type CoFailureTelemetry = z.infer<typeof CoFailureTelemetrySchema>;

export class RouterError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "RouterError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class ProcessExecutionError extends Error {
  readonly codeName: string;
  readonly exitCode?: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly retryAfterMs?: number;

  constructor(
    codeName: string,
    message: string,
    options?: {
      exitCode?: number;
      stdout?: string;
      stderr?: string;
      retryAfterMs?: number;
      cause?: unknown;
    },
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = "ProcessExecutionError";
    this.codeName = codeName;
    this.exitCode = options?.exitCode;
    this.stdout = options?.stdout ?? "";
    this.stderr = options?.stderr ?? "";
    this.retryAfterMs = options?.retryAfterMs;
  }
}

function failClosed(
  status: number,
  code: string,
  message: string,
  details?: unknown,
): never {
  throw new RouterError(status, code, message, details);
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function errorCode(error: unknown): string {
  if (error instanceof z.ZodError) {
    return "validation_failed";
  }

  if (error instanceof RouterError) {
    return error.code;
  }

  if (error instanceof ProcessExecutionError) {
    return error.codeName;
  }

  return "adapter_failed";
}

async function sleepWithAbort(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    throw new ProcessExecutionError(
      "aborted",
      "Request aborted before adapter execution.",
    );
  }

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      reject(
        new ProcessExecutionError("aborted", "Request aborted or timed out."),
      );
    };

    signal.addEventListener("abort", onAbort, { once: true });
  });
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

export type RetryPolicy = {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
};

export type CircuitBreakerOptions = {
  failureThreshold: number;
  cooldownMs: number;
};

export interface BudgetManager {
  consume(label: string, amountUsd: number): void;
  snapshot(): { limitUsd: number; spentUsd: number; remainingUsd: number };
}

export class InMemoryBudgetManager implements BudgetManager {
  private readonly limitUsd: number;
  private spentUsd = 0;

  constructor(limitUsd: number) {
    if (!(limitUsd > 0)) {
      throw new Error("Budget limit must be > 0.");
    }

    this.limitUsd = limitUsd;
  }

  consume(label: string, amountUsd: number): void {
    if (!(amountUsd >= 0)) {
      throw new Error("amountUsd must be >= 0.");
    }

    if (this.spentUsd + amountUsd > this.limitUsd) {
      throw new ProcessExecutionError(
        "budget_exhausted",
        `Budget exhausted before invoking ${label}. Remaining budget: ${
          (this.limitUsd - this.spentUsd).toFixed(4)
        } USD.`,
      );
    }

    this.spentUsd += amountUsd;
  }

  snapshot() {
    return {
      limitUsd: this.limitUsd,
      spentUsd: this.spentUsd,
      remainingUsd: this.limitUsd - this.spentUsd,
    };
  }
}

class CircuitBreaker {
  private readonly failureThreshold: number;
  private readonly cooldownMs: number;
  private consecutiveFailures = 0;
  private openUntil = 0;

  constructor(options: CircuitBreakerOptions) {
    this.failureThreshold = options.failureThreshold;
    this.cooldownMs = options.cooldownMs;
  }

  assertAvailable(label: string): void {
    if (Date.now() < this.openUntil) {
      throw new ProcessExecutionError(
        "circuit_open",
        `${label} circuit open until ${
          new Date(this.openUntil).toISOString()
        }.`,
      );
    }
  }

  recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.openUntil = 0;
  }

  recordFailure(): void {
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.failureThreshold) {
      this.openUntil = Date.now() + this.cooldownMs;
    }
  }
}

export type AuthStrategy = {
  env?: Record<string, string>;
  readinessCheck?: ProcessInvocation | (() => ProcessInvocation);
  refreshCommand?: ProcessInvocation | (() => ProcessInvocation);
};

export type ModelOutputParser = (
  result: ProcessExecutionResult,
  descriptor: ProviderDescriptor,
) => ModelOutput;

export interface ModelAdapter {
  readonly descriptor: ProviderDescriptor;
  invoke(prompt: string, signal: AbortSignal): Promise<ModelOutput>;
}

export interface SynthesisAdapter {
  readonly descriptor: ProviderDescriptor;
  synthesize(
    prompt: string,
    outputs: ModelOutput[],
    signal: AbortSignal,
  ): Promise<FinalSynthesis>;
}

export type TelemetrySink = (
  telemetry: CoFailureTelemetry,
) => void | Promise<void>;

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

function repoLocalBin(name: string): string {
  return `${Deno.cwd()}/bin/${name}`;
}

function extractRetryAfterMs(text: string): number | undefined {
  const retryAfterMatch = text.match(/retry[- ]after[:= ]+(\d+(?:\.\d+)?)s?/i);
  if (retryAfterMatch) {
    return Math.ceil(Number(retryAfterMatch[1]) * 1000);
  }

  return undefined;
}

function classifyProcessFailure(
  message: string,
  stdout: string,
  stderr: string,
  exitCode?: number,
): ProcessExecutionError {
  const haystack = `${message}\n${stdout}\n${stderr}`.toLowerCase();
  const retryAfterMs = extractRetryAfterMs(`${stdout}\n${stderr}`);

  if (haystack.includes("timed out")) {
    return new ProcessExecutionError("timeout", message, {
      exitCode,
      stdout,
      stderr,
      retryAfterMs,
    });
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
    return new ProcessExecutionError("auth_failed", message, {
      exitCode,
      stdout,
      stderr,
      retryAfterMs,
    });
  }

  if (
    haystack.includes("model config is missing") ||
    haystack.includes("explicit model provider")
  ) {
    return new ProcessExecutionError("wrapper_config_missing", message, {
      exitCode,
      stdout,
      stderr,
      retryAfterMs,
    });
  }

  if (
    haystack.includes("rate limit") ||
    haystack.includes("429") ||
    haystack.includes("too many requests")
  ) {
    return new ProcessExecutionError("rate_limited", message, {
      exitCode,
      stdout,
      stderr,
      retryAfterMs,
    });
  }

  if (
    haystack.includes("not found") ||
    haystack.includes("no such file or directory")
  ) {
    return new ProcessExecutionError("command_unavailable", message, {
      exitCode,
      stdout,
      stderr,
      retryAfterMs,
    });
  }

  return new ProcessExecutionError("process_failed", message, {
    exitCode,
    stdout,
    stderr,
    retryAfterMs,
  });
}

function isRetriableError(error: unknown): boolean {
  if (error instanceof ProcessExecutionError) {
    return ["rate_limited", "timeout", "process_failed"].includes(
      error.codeName,
    );
  }

  return false;
}

function shouldCountTowardsCircuitBreaker(error: unknown): boolean {
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

function backoffDelayMs(
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

  let child: Deno.ChildProcess | undefined;
  let aborted = false;
  let timedOut = false;

  const onAbort = () => {
    aborted = true;
    try {
      child?.kill("SIGTERM");
    } catch {
      // best effort
    }
  };

  let timeoutId: ReturnType<typeof setTimeout> | undefined;

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

    timeoutId = setTimeout(() => {
      timedOut = true;
      try {
        child?.kill("SIGTERM");
      } catch {
        // best effort
      }
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
    })();

    const [{ code, stdout, stderr }] = await Promise.all([
      child.output(),
      stdinPromise,
    ]);

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
        },
      );
    }

    if (aborted || signal.aborted) {
      throw new ProcessExecutionError("aborted", `${label} was aborted.`, {
        exitCode: code,
        stdout: stdoutText,
        stderr: stderrText,
      });
    }

    if (code !== 0) {
      throw classifyProcessFailure(
        `${label} exited with status ${code}.`,
        stdoutText,
        stderrText,
        code,
      );
    }

    return {
      code,
      stdout: stdoutText,
      stderr: stderrText,
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
    signal.removeEventListener("abort", onAbort);
  }
}

function parsePlainTextModelOutput(
  result: ProcessExecutionResult,
  descriptor: ProviderDescriptor,
): ModelOutput {
  const content = result.stdout.trim();

  if (content.startsWith("Error:")) {
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

function parseCodexJsonlOutput(
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

function parseClineJsonlOutput(
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

    const tmpDir = await Deno.makeTempDir({ prefix: "fusion-router-codex-" });
    const schemaPath = `${tmpDir}/schema.json`;
    const outputPath = `${tmpDir}/out.json`;

    try {
      await Deno.writeTextFile(
        schemaPath,
        JSON.stringify(FinalSynthesisJsonSchema, null, 2),
      );

      const sourceLines = outputs
        .map((output, index) =>
          `${index + 1}. [${output.provider}/${output.model}] ${output.content}`
        )
        .join("\n");

      const synthesisPrompt = [
        "You are the consensus stage of a fail-closed fusion router.",
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

function buildCoFailureTelemetry(
  adapters: ModelAdapter[],
  settled: PromiseSettledResult<ModelOutput>[],
): CoFailureTelemetry {
  const failures: TelemetryFailure[] = settled.flatMap((result, index) => {
    if (result.status === "fulfilled") {
      return [];
    }

    const descriptor = adapters[index].descriptor;
    return [{
      provider: descriptor.provider,
      model: descriptor.model,
      code: errorCode(result.reason),
      message: errorMessage(result.reason),
    }];
  });

  return CoFailureTelemetrySchema.parse({
    totalAdapters: adapters.length,
    successfulAdapters: settled.length - failures.length,
    failedAdapters: failures.length,
    failures,
  });
}

export type OtlpTelemetrySinkOptions = {
  endpoint: string;
  headers?: Record<string, string>;
  serviceName?: string;
};

function toOtlpAttribute(
  key: string,
  value: string | number,
): Record<string, unknown> {
  if (typeof value === "number") {
    return { key, value: { intValue: value } };
  }

  return { key, value: { stringValue: value } };
}

function toOtlpLogPayload(
  telemetry: CoFailureTelemetry,
  serviceName: string,
): Record<string, unknown> {
  const attributes: Record<string, unknown>[] = [
    toOtlpAttribute("fusion.total_adapters", telemetry.totalAdapters),
    toOtlpAttribute("fusion.successful_adapters", telemetry.successfulAdapters),
    toOtlpAttribute("fusion.failed_adapters", telemetry.failedAdapters),
  ];

  telemetry.failures.forEach((failure, index) => {
    attributes.push(
      toOtlpAttribute(`fusion.failures.${index}.provider`, failure.provider),
    );
    attributes.push(
      toOtlpAttribute(`fusion.failures.${index}.model`, failure.model),
    );
    attributes.push(
      toOtlpAttribute(`fusion.failures.${index}.code`, failure.code),
    );
    attributes.push(
      toOtlpAttribute(`fusion.failures.${index}.message`, failure.message),
    );
  });

  return {
    resourceLogs: [
      {
        resource: {
          attributes: [
            toOtlpAttribute("service.name", serviceName),
          ],
        },
        scopeLogs: [
          {
            scope: { name: "fusion-router" },
            logRecords: [
              {
                timeUnixNano: `${Date.now()}000000`,
                severityText: "WARN",
                body: { stringValue: "co_failure_telemetry" },
                attributes,
              },
            ],
          },
        ],
      },
    ],
  };
}

export function createOtlpHttpTelemetrySink(
  options: OtlpTelemetrySinkOptions,
): TelemetrySink {
  return async (telemetry) => {
    const response = await fetch(options.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(options.headers ?? {}),
      },
      body: JSON.stringify(
        toOtlpLogPayload(telemetry, options.serviceName ?? "fusion-router"),
      ),
    });

    if (!response.ok) {
      throw new ProcessExecutionError(
        "telemetry_sink_failed",
        `Telemetry sink rejected payload with HTTP ${response.status}.`,
      );
    }
  };
}

export function createCompositeTelemetrySink(
  ...sinks: TelemetrySink[]
): TelemetrySink {
  return async (telemetry) => {
    await Promise.all(sinks.map((sink) => sink(telemetry)));
  };
}

async function publishTelemetryBestEffort(
  telemetrySink: TelemetrySink | undefined,
  telemetry: CoFailureTelemetry,
): Promise<void> {
  if (!telemetrySink) {
    return;
  }

  try {
    await telemetrySink(telemetry);
  } catch (error) {
    console.warn(`Telemetry sink failure: ${errorMessage(error)}`);
  }
}

export type FusionRouterOptions = {
  modelAdapters: ModelAdapter[];
  synthesisAdapter: SynthesisAdapter;
  timeoutMs?: number;
  minSuccessfulAdapters?: number;
  telemetrySink?: TelemetrySink;
};

export class FusionRouter {
  private readonly modelAdapters: ModelAdapter[];
  private readonly synthesisAdapter: SynthesisAdapter;
  private readonly timeoutMs: number;
  private readonly minSuccessfulAdapters: number;
  private readonly telemetrySink?: TelemetrySink;

  constructor(options: FusionRouterOptions) {
    if (options.modelAdapters.length === 0) {
      throw new Error("FusionRouter requires at least one model adapter.");
    }

    this.modelAdapters = options.modelAdapters;
    this.synthesisAdapter = options.synthesisAdapter;
    this.timeoutMs = options.timeoutMs ?? 120_000;
    this.minSuccessfulAdapters = Math.max(
      1,
      options.minSuccessfulAdapters ??
        Math.min(2, options.modelAdapters.length),
    );

    if (this.minSuccessfulAdapters > options.modelAdapters.length) {
      throw new Error(
        `minSuccessfulAdapters (${this.minSuccessfulAdapters}) cannot exceed modelAdapters.length (${options.modelAdapters.length}).`,
      );
    }

    this.telemetrySink = options.telemetrySink;
  }

  async route(prompt: string): Promise<FinalSynthesis> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      console.log("Starting parallel model execution...");

      const settled = await Promise.allSettled(
        this.modelAdapters.map((adapter) =>
          adapter.invoke(prompt, controller.signal)
        ),
      );

      const telemetry = buildCoFailureTelemetry(this.modelAdapters, settled);
      if (telemetry.failedAdapters > 0) {
        void publishTelemetryBestEffort(this.telemetrySink, telemetry);
      }

      const successfulOutputs = settled
        .filter((result): result is PromiseFulfilledResult<ModelOutput> =>
          result.status === "fulfilled"
        )
        .map((result) => result.value);

      if (successfulOutputs.length < this.minSuccessfulAdapters) {
        failClosed(
          4401,
          "consensus_insufficient",
          `Validated quorum not met: required ${this.minSuccessfulAdapters}, got ${successfulOutputs.length}.`,
          telemetry,
        );
      }

      console.log(
        `Received ${successfulOutputs.length} validated responses. Synthesizing with ${this.synthesisAdapter.descriptor.provider}/${this.synthesisAdapter.descriptor.model}...`,
      );

      try {
        const finalResponse = await this.synthesisAdapter.synthesize(
          prompt,
          successfulOutputs,
          controller.signal,
        );
        return FinalSynthesisSchema.parse(finalResponse);
      } catch (error) {
        failClosed(
          4401,
          "consensus_validation_failed",
          "Consensus stage failed validation.",
          {
            cause: errorMessage(error),
            telemetry,
          },
        );
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

const consoleTelemetrySink: TelemetrySink = (telemetry) => {
  console.warn("Co-failure telemetry:");
  console.warn(JSON.stringify(telemetry, null, 2));
};

function maybeCreateEnvTelemetrySink(): TelemetrySink | undefined {
  const endpoint = Deno.env.get("OTEL_EXPORTER_OTLP_ENDPOINT");
  if (!endpoint) {
    return undefined;
  }

  return createOtlpHttpTelemetrySink({
    endpoint,
    serviceName: "fusion-router",
  });
}

function createDefaultRouter(): FusionRouter {
  const envTelemetrySink = maybeCreateEnvTelemetrySink();
  const telemetrySink = envTelemetrySink
    ? createCompositeTelemetrySink(consoleTelemetrySink, envTelemetrySink)
    : consoleTelemetrySink;

  return new FusionRouter({
    timeoutMs: 120_000,
    minSuccessfulAdapters: 2,
    telemetrySink,
    modelAdapters: [
      createCodexCliAdapter({ budgetManager: new InMemoryBudgetManager(0.25) }),
      createClaudeCodeAdapter({
        budgetManager: new InMemoryBudgetManager(0.25),
      }),
      createGeminiCliAdapter({
        budgetManager: new InMemoryBudgetManager(0.15),
      }),
      createGrokCliAdapter({ budgetManager: new InMemoryBudgetManager(0.2) }),
      createDevinCliAdapter({ budgetManager: new InMemoryBudgetManager(0.2) }),
      createClineCliAdapter({ budgetManager: new InMemoryBudgetManager(0.15) }),
      createZcodeGlmAdapter({
        command: repoLocalBin("zcode-headless"),
        budgetManager: new InMemoryBudgetManager(0.15),
        auth: {
          env: {
            ZCODE_HOME: Deno.env.get("ZCODE_HOME") ?? Deno.env.get("HOME") ??
              "/Users/tetsu",
          },
          readinessCheck: {
            command: repoLocalBin("zcode-headless"),
            args: ["doctor"],
          },
        },
      }),
    ],
    synthesisAdapter: createCodexStructuredSynthesisAdapter({
      budgetManager: new InMemoryBudgetManager(0.25),
    }),
  });
}

if (import.meta.main) {
  const router = createDefaultRouter();

  try {
    const result = await router.route(
      "Explain the impact of quantum computing on encryption.",
    );
    console.log("\n--- Final Synthesis Result ---");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    if (error instanceof RouterError) {
      console.error(
        `Router Error [${error.status}/${error.code}]: ${error.message}`,
      );
      console.error(JSON.stringify(error.details, null, 2));
    } else if (error instanceof Error) {
      console.error("Router Error:", error.message);
    } else {
      console.error("Router Error:", String(error));
    }
  }
}
