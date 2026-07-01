import { z } from "zod";

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
const TransportSchema = z.enum([
  "zcodeWrapper",
  "processAdapter",
  "directHttp",
]);

export const RoutingModeSchema = z.enum(["direct", "agent_chat"]);
export type RoutingMode = z.infer<typeof RoutingModeSchema>;
export type ExplicitRoutingModeSource = "request" | "config" | "env";
export type RoutingModeSource = ExplicitRoutingModeSource | "default";
export type RoutingModeResolution = {
  mode: RoutingMode;
  source: RoutingModeSource;
};
export type RoutingModeResolveInput = {
  requestMode?: unknown;
  configMode?: unknown;
  envMode?: unknown;
};

export const ROUTING_MODE_ENV = "FUSION_ROUTER_MODE";
export const ALLOWED_ROUTING_MODES = RoutingModeSchema.options;

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
    super(sanitizeDiagnosticText(message));
    this.name = "RouterError";
    this.status = status;
    this.code = code;
    this.details = sanitizeDiagnosticValue(details);
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
      redactionValues?: string[];
    },
  ) {
    const redactionValues = options?.redactionValues ?? [];
    super(
      sanitizeDiagnosticText(message, redactionValues),
      options?.cause ? { cause: options.cause } : undefined,
    );
    this.name = "ProcessExecutionError";
    this.codeName = codeName;
    this.exitCode = options?.exitCode;
    this.stdout = sanitizeDiagnosticText(
      options?.stdout ?? "",
      redactionValues,
    );
    this.stderr = sanitizeDiagnosticText(
      options?.stderr ?? "",
      redactionValues,
    );
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

export function parseRoutingMode(
  value: unknown,
  source: ExplicitRoutingModeSource,
): RoutingModeResolution | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    failClosed(
      4400,
      "invalid_routing_mode",
      `Invalid routing mode selected from ${source}. Allowed values: ${
        ALLOWED_ROUTING_MODES.join(
          ", ",
        )
      }.`,
      {
        source,
        allowedModes: ALLOWED_ROUTING_MODES,
        receivedType: value === null ? "null" : typeof value,
      },
    );
  }

  const parsed = RoutingModeSchema.safeParse(value.trim());
  if (!parsed.success) {
    failClosed(
      4400,
      "invalid_routing_mode",
      `Invalid routing mode selected from ${source}. Allowed values: ${
        ALLOWED_ROUTING_MODES.join(
          ", ",
        )
      }.`,
      {
        source,
        allowedModes: ALLOWED_ROUTING_MODES,
      },
    );
  }

  return { mode: parsed.data, source };
}

export function resolveRoutingMode(
  input: RoutingModeResolveInput = {},
): RoutingModeResolution {
  return parseRoutingMode(input.requestMode, "request") ??
    parseRoutingMode(input.configMode, "config") ??
    parseRoutingMode(input.envMode, "env") ??
    { mode: "direct", source: "default" };
}

function readRoutingModeEnv(): string | undefined {
  try {
    return Deno.env.get(ROUTING_MODE_ENV);
  } catch {
    return undefined;
  }
}

function assertImplementedRoutingMode(resolution: RoutingModeResolution): void {
  if (resolution.mode === "agent_chat") {
    failClosed(
      4401,
      "routing_mode_not_implemented",
      "Routing mode agent_chat is recognized but not implemented.",
      resolution,
    );
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return sanitizeDiagnosticText(error.message);
  }

  return sanitizeDiagnosticText(String(error));
}

function hasCredentialLikeName(name: string): boolean {
  return /(auth|credential|key|password|secret|session|token)/i.test(name);
}

function credentialValuesFromEnv(
  env: Record<string, string> | undefined,
): string[] {
  return Object.entries(env ?? {})
    .filter(([name, value]) =>
      hasCredentialLikeName(name) && value.trim().length >= 4
    )
    .map(([, value]) => value.trim());
}

function credentialValuesFromUrl(rawUrl: string): string[] {
  try {
    const url = new URL(rawUrl);
    return [url.username, url.password]
      .map((value) => decodeURIComponent(value).trim())
      .filter((value) => value.length >= 4);
  } catch {
    return [];
  }
}

function sanitizeEndpointForDiagnostic(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    const authRedaction = url.username || url.password ? "[REDACTED]@" : "";
    return `${url.protocol}//${authRedaction}${url.host}${url.pathname}${url.search}${url.hash}`;
  } catch {
    return sanitizeDiagnosticText(rawUrl);
  }
}

function ambientCredentialValues(): string[] {
  try {
    return credentialValuesFromEnv(Deno.env.toObject());
  } catch {
    return [];
  }
}

function sanitizeDiagnosticText(
  text: string,
  extraCredentialValues: string[] = [],
): string {
  const credentialValues = [
    ...ambientCredentialValues(),
    ...extraCredentialValues,
  ].filter((value) => value.length >= 4);

  return redactSecrets(text, credentialValues)
    .replace(
      /(authorization\s*:?\s*bearer\s+)[^\s"'`]+/gi,
      "$1[REDACTED]",
    )
    .replace(
      /((?:api[_-]?key|auth|credential|password|secret|session|token)\s*[:=]\s*)[^\s"'`]+/gi,
      "$1[REDACTED]",
    );
}

function sanitizeDiagnosticValue(value: unknown): unknown {
  if (typeof value === "string") {
    return sanitizeDiagnosticText(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeDiagnosticValue(item));
  }

  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        sanitizeDiagnosticValue(item),
      ]),
    );
  }

  return value;
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
  const redactionValues = credentialValuesFromEnv(invocation.env);

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

export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export type DirectHttpRequest = {
  url: string;
  init: RequestInit;
};

export type DirectHttpExecutionResult = {
  json: unknown;
  durationMs: number;
};

export type DirectHttpResponseParser = (
  result: DirectHttpExecutionResult,
  descriptor: ProviderDescriptor,
) => ModelOutput;

export type DirectHttpAdapterOptions = {
  descriptor: ProviderDescriptor;
  apiKeyEnv: string;
  apiKeyProvider?: () => string | undefined;
  buildRequest: (prompt: string, apiKey: string) => DirectHttpRequest;
  parseResponse: DirectHttpResponseParser;
  fetchFn?: FetchLike;
  retryPolicy?: RetryPolicy;
  circuitBreaker?: CircuitBreakerOptions;
  budgetManager?: BudgetManager;
  estimatedCostUsd?: number;
  defaultTimeoutMs?: number;
};

function trimApiKey(apiKey: string | undefined): string | undefined {
  const trimmed = apiKey?.trim();
  return trimmed ? trimmed : undefined;
}

function redactSecrets(text: string, secrets: string[]): string {
  return secrets
    .filter((secret) => secret.length > 0)
    .reduce(
      (current, secret) => current.split(secret).join("[REDACTED]"),
      text,
    );
}

function truncateForError(text: string, maxLength = 500): string {
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

function retryAfterHeaderMs(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.ceil(seconds * 1000);
  }

  const epochMs = Date.parse(value);
  if (Number.isFinite(epochMs)) {
    return Math.max(0, epochMs - Date.now());
  }

  return undefined;
}

async function classifyDirectHttpFailure(
  response: Response,
  label: string,
  secrets: string[],
): Promise<ProcessExecutionError> {
  const retryAfterMs = retryAfterHeaderMs(response.headers.get("retry-after"));
  const rawBody = await response.text().catch(() => "");
  const body = truncateForError(
    sanitizeDiagnosticText(redactSecrets(rawBody, secrets), secrets),
  );
  const message = body
    ? `${label} HTTP ${response.status}: ${body}`
    : `${label} HTTP ${response.status}.`;

  if (response.status === 401 || response.status === 403) {
    return new ProcessExecutionError("auth_failed", message, {
      retryAfterMs,
      redactionValues: secrets,
    });
  }

  if (response.status === 429) {
    return new ProcessExecutionError("rate_limited", message, {
      retryAfterMs,
      redactionValues: secrets,
    });
  }

  if (response.status >= 500) {
    return new ProcessExecutionError("process_failed", message, {
      retryAfterMs,
      redactionValues: secrets,
    });
  }

  return new ProcessExecutionError("provider_malformed", message, {
    retryAfterMs,
    redactionValues: secrets,
  });
}

async function fetchDirectHttpJson(
  request: DirectHttpRequest,
  signal: AbortSignal,
  label: string,
  defaultTimeoutMs: number,
  fetchFn: FetchLike,
  secrets: string[],
): Promise<DirectHttpExecutionResult> {
  if (signal.aborted) {
    throw new ProcessExecutionError(
      "aborted",
      `${label} aborted before direct HTTP request.`,
    );
  }

  const startedAt = Date.now();
  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, defaultTimeoutMs);

  const onAbort = () => controller.abort();

  try {
    signal.addEventListener("abort", onAbort, { once: true });
    const response = await fetchFn(request.url, {
      ...request.init,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw await classifyDirectHttpFailure(response, label, secrets);
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch (error) {
      throw new ProcessExecutionError(
        "provider_malformed",
        `${label} returned invalid JSON: ${errorMessage(error)}`,
      );
    }

    return {
      json,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    if (error instanceof ProcessExecutionError) {
      throw error;
    }

    const name = error instanceof Error ? error.name : "";
    if (timedOut || name === "AbortError") {
      const codeName = timedOut ? "timeout" : "aborted";
      const reason = timedOut
        ? `${label} direct HTTP request timed out after ${defaultTimeoutMs}ms.`
        : `${label} direct HTTP request was aborted.`;
      throw new ProcessExecutionError(codeName, reason, { cause: error });
    }

    throw classifyProcessFailure(
      redactSecrets(errorMessage(error), secrets),
      "",
      "",
      undefined,
    );
  } finally {
    clearTimeout(timeoutId);
    signal.removeEventListener("abort", onAbort);
  }
}

class DirectHttpModelAdapter implements ModelAdapter {
  readonly descriptor: ProviderDescriptor;
  private readonly apiKeyEnv: string;
  private readonly apiKeyProvider: () => string | undefined;
  private readonly buildRequest: (
    prompt: string,
    apiKey: string,
  ) => DirectHttpRequest;
  private readonly parseResponse: DirectHttpResponseParser;
  private readonly fetchFn: FetchLike;
  private readonly retryPolicy: RetryPolicy;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly budgetManager?: BudgetManager;
  private readonly estimatedCostUsd: number;
  private readonly defaultTimeoutMs: number;

  constructor(options: DirectHttpAdapterOptions) {
    this.descriptor = ProviderDescriptorSchema.parse(options.descriptor);
    this.apiKeyEnv = options.apiKeyEnv;
    this.apiKeyProvider = options.apiKeyProvider ??
      (() => Deno.env.get(options.apiKeyEnv));
    this.buildRequest = options.buildRequest;
    this.parseResponse = options.parseResponse;
    this.fetchFn = options.fetchFn ?? fetch;
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
        const credential = trimApiKey(this.apiKeyProvider());
        if (!credential) {
          throw new ProcessExecutionError(
            "auth_failed",
            `${label} missing API key environment variable ${this.apiKeyEnv}.`,
          );
        }

        if (
          !budgetReserved && this.estimatedCostUsd > 0 && this.budgetManager
        ) {
          this.budgetManager.consume(label, this.estimatedCostUsd);
          budgetReserved = true;
        }

        const result = await fetchDirectHttpJson(
          this.buildRequest(prompt, credential),
          signal,
          label,
          this.defaultTimeoutMs,
          this.fetchFn,
          [credential],
        );

        try {
          const parsed = this.parseResponse(result, this.descriptor);
          this.circuitBreaker.recordSuccess();
          return ModelOutputSchema.parse(parsed);
        } catch (error) {
          throw new ProcessExecutionError(
            "provider_malformed",
            `${label} returned malformed provider response: ${
              errorMessage(error)
            }`,
            { cause: error },
          );
        }
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

export function createDirectHttpAdapter(
  options: DirectHttpAdapterOptions,
): ModelAdapter {
  return new DirectHttpModelAdapter(options);
}

function getPath(obj: unknown, path: Array<string | number>): unknown {
  return path.reduce<unknown>((current, segment) => {
    if (typeof segment === "number") {
      return Array.isArray(current) ? current[segment] : undefined;
    }
    if (typeof current === "object" && current !== null && segment in current) {
      return (current as Record<string, unknown>)[segment];
    }
    return undefined;
  }, obj);
}

function parseOpenAIChatContent(
  result: DirectHttpExecutionResult,
  descriptor: ProviderDescriptor,
): ModelOutput {
  const content = getPath(result.json, ["choices", 0, "message", "content"]);
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("missing choices[0].message.content");
  }

  const responseModel = getPath(result.json, ["model"]);
  return ModelOutputSchema.parse({
    content: content.trim(),
    model: typeof responseModel === "string" && responseModel.trim()
      ? responseModel
      : descriptor.model,
    provider: descriptor.provider,
    latencyMs: result.durationMs,
  });
}

function parseAnthropicMessageContent(
  result: DirectHttpExecutionResult,
  descriptor: ProviderDescriptor,
): ModelOutput {
  const blocks = getPath(result.json, ["content"]);
  if (!Array.isArray(blocks)) {
    throw new Error("missing content blocks");
  }

  const content = blocks
    .flatMap((block) => {
      if (
        typeof block === "object" && block !== null &&
        (block as { type?: unknown }).type === "text" &&
        typeof (block as { text?: unknown }).text === "string"
      ) {
        return [(block as { text: string }).text];
      }
      return [];
    })
    .join("\n")
    .trim();

  if (!content) {
    throw new Error("missing text content block");
  }

  const responseModel = getPath(result.json, ["model"]);
  return ModelOutputSchema.parse({
    content,
    model: typeof responseModel === "string" && responseModel.trim()
      ? responseModel
      : descriptor.model,
    provider: descriptor.provider,
    latencyMs: result.durationMs,
  });
}

export type OpenAIDirectAdapterOptions = {
  model?: string;
  endpoint?: string;
  apiKeyEnv?: string;
  apiKeyProvider?: () => string | undefined;
  fetchFn?: FetchLike;
  budgetManager?: BudgetManager;
  retryPolicy?: RetryPolicy;
  defaultTimeoutMs?: number;
};

export function createOpenAIDirectAdapter(
  options: OpenAIDirectAdapterOptions = {},
): ModelAdapter {
  const model = options.model ?? "gpt-4o-mini";
  const endpoint = options.endpoint ??
    "https://api.openai.com/v1/chat/completions";

  return createDirectHttpAdapter({
    descriptor: {
      provider: "OpenAI",
      model,
      authMode: "apiKey",
      transport: "directHttp",
      client: "OpenAIChatCompletions",
    },
    apiKeyEnv: options.apiKeyEnv ?? "OPENAI_API_KEY",
    apiKeyProvider: options.apiKeyProvider,
    fetchFn: options.fetchFn,
    retryPolicy: options.retryPolicy,
    budgetManager: options.budgetManager,
    estimatedCostUsd: 0.02,
    defaultTimeoutMs: options.defaultTimeoutMs,
    parseResponse: parseOpenAIChatContent,
    buildRequest: (prompt, apiKey) => ({
      url: endpoint,
      init: {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
        }),
      },
    }),
  });
}

export type AnthropicDirectAdapterOptions = {
  model?: string;
  endpoint?: string;
  apiKeyEnv?: string;
  apiKeyProvider?: () => string | undefined;
  fetchFn?: FetchLike;
  budgetManager?: BudgetManager;
  retryPolicy?: RetryPolicy;
  defaultTimeoutMs?: number;
  maxTokens?: number;
};

export function createAnthropicDirectAdapter(
  options: AnthropicDirectAdapterOptions = {},
): ModelAdapter {
  const model = options.model ?? "claude-3-5-haiku-latest";
  const endpoint = options.endpoint ?? "https://api.anthropic.com/v1/messages";

  return createDirectHttpAdapter({
    descriptor: {
      provider: "Anthropic",
      model,
      authMode: "apiKey",
      transport: "directHttp",
      client: "AnthropicMessagesAPI",
    },
    apiKeyEnv: options.apiKeyEnv ?? "ANTHROPIC_API_KEY",
    apiKeyProvider: options.apiKeyProvider,
    fetchFn: options.fetchFn,
    retryPolicy: options.retryPolicy,
    budgetManager: options.budgetManager,
    estimatedCostUsd: 0.03,
    defaultTimeoutMs: options.defaultTimeoutMs,
    parseResponse: parseAnthropicMessageContent,
    buildRequest: (prompt, apiKey) => ({
      url: endpoint,
      init: {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: options.maxTokens ?? 1024,
          messages: [{ role: "user", content: prompt }],
        }),
      },
    }),
  });
}

export type OpenAIDirectSynthesisAdapterOptions = OpenAIDirectAdapterOptions;

export class OpenAIDirectSynthesisAdapter implements SynthesisAdapter {
  readonly descriptor: ProviderDescriptor;
  private readonly adapter: ModelAdapter;

  constructor(options: OpenAIDirectSynthesisAdapterOptions = {}) {
    const model = options.model ?? "gpt-4o-mini";
    this.descriptor = ProviderDescriptorSchema.parse({
      provider: "OpenAI",
      model,
      authMode: "apiKey",
      transport: "directHttp",
      client: "OpenAIChatCompletions",
    });
    this.adapter = createOpenAIDirectAdapter({ ...options, model });
  }

  async synthesize(
    prompt: string,
    outputs: ModelOutput[],
    signal: AbortSignal,
  ): Promise<FinalSynthesis> {
    const sourceLines = outputs
      .map((output, index) =>
        `${index + 1}. [${output.provider}/${output.model}] ${output.content}`
      )
      .join("\n");
    const synthesisPrompt = [
      "You are the consensus stage of a fail-closed fusion router.",
      "Return only a JSON object with keys: synthesis, reasoning, consensusModel, sources.",
      "Do not wrap the JSON in markdown.",
      `Original user prompt: ${prompt}`,
      "Validated upstream outputs:",
      sourceLines,
      `Set consensusModel to ${this.descriptor.provider}/${this.descriptor.model}.`,
      "Set sources to the list of contributing provider/model labels.",
    ].join("\n\n");

    const output = await this.adapter.invoke(synthesisPrompt, signal);
    return FinalSynthesisSchema.parse(JSON.parse(output.content));
  }
}

export function createOpenAIDirectSynthesisAdapter(
  options: OpenAIDirectSynthesisAdapterOptions = {},
): SynthesisAdapter {
  return new OpenAIDirectSynthesisAdapter(options);
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

export type TelemetryFlushOptions = {
  maxDurationMs?: number;
  force?: boolean;
};

export type BufferedSinkOverflowPolicy = "drop_oldest" | "fail_closed";
export type BufferedSinkDeliveryMode = "best_effort" | "must_accept";

export type BufferedSinkFlushContext = {
  deadlineMs: number;
};

export type BufferedBatchHandler<TRecord> = (
  records: readonly TRecord[],
  context: BufferedSinkFlushContext,
) => void | Promise<void>;

export type BufferedBatchSinkStats = {
  queueSize: number;
  maxQueueSize: number;
  enqueued: number;
  delivered: number;
  rejected: number;
  droppedOldest: number;
  droppedAfterRetries: number;
  failedFlushes: number;
  closed: boolean;
};

export type BufferedBatchSink<TRecord> =
  & ((
    record: TRecord,
  ) => void | Promise<void>)
  & {
    flush: (options?: TelemetryFlushOptions) => Promise<void>;
    close: (options?: TelemetryFlushOptions) => Promise<void>;
    stats: () => BufferedBatchSinkStats;
  };

export type BufferedTelemetrySinkStats = BufferedBatchSinkStats;

export type FlushableTelemetrySink = BufferedBatchSink<CoFailureTelemetry>;

export type OtlpTelemetrySinkOptions = {
  endpoint: string;
  headers?: Record<string, string>;
  serviceName?: string;
  timeoutMs?: number;
};

export type BufferedBatchSinkOptions = {
  name?: string;
  maxQueueSize?: number;
  maxBatchSize?: number;
  flushIntervalMs?: number;
  maxAttempts?: number;
  baseBackoffMs?: number;
  maxBackoffMs?: number;
  backoffMultiplier?: number;
  defaultDrainMs?: number;
  registerUnloadHook?: boolean;
  overflowPolicy?: BufferedSinkOverflowPolicy;
  deliveryMode?: BufferedSinkDeliveryMode;
  now?: () => number;
};

export type BufferedTelemetrySinkOptions = BufferedBatchSinkOptions;

type BufferedBatchEntry<TRecord> = {
  record: TRecord;
  attempts: number;
  nextAttemptAt: number;
};

export type SupabaseAuditRecord = {
  eventType: string;
  actorType: "ai_assistant" | "user" | "system";
  actorId?: string;
  workflowId?: string;
  route?: string;
  decision: "allow" | "deny" | "error";
  reason?: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
};

export type SupabaseAuditSinkOptions = BufferedBatchSinkOptions & {
  flushHandler: BufferedBatchHandler<SupabaseAuditRecord>;
};

export type SupabaseAuditHandlerOptions = {
  supabaseUrl: string;
  jwtProvider: () => string | undefined;
  anonKeyProvider: () => string | undefined;
  fetchFn?: FetchLike;
  timeoutMs?: number;
};

const TELEMETRY_MAX_QUEUE_SIZE = 10_000;
const TELEMETRY_MAX_BATCH_SIZE = 500;
const TELEMETRY_MAX_FLUSH_INTERVAL_MS = 60_000;
const TELEMETRY_MAX_ATTEMPTS = 10;
const TELEMETRY_MAX_BASE_BACKOFF_MS = 60_000;
const TELEMETRY_MAX_BACKOFF_MS = 300_000;
const TELEMETRY_MAX_DRAIN_MS = 5_000;
const TELEMETRY_MAX_HTTP_TIMEOUT_MS = 30_000;

function positiveInteger(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && value !== undefined && value > 0
    ? Math.floor(value)
    : fallback;
}

function boundedInteger(
  value: number | undefined,
  fallback: number,
  max: number,
): number {
  return Math.min(positiveInteger(value, fallback), max);
}

function boundedEnvInteger(
  name: string,
  fallback: number,
  max: number,
): number {
  const value = Number(Deno.env.get(name));
  return boundedInteger(value, fallback, max);
}

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
  telemetry: CoFailureTelemetry | readonly CoFailureTelemetry[],
  serviceName: string,
): Record<string, unknown> {
  const records: readonly CoFailureTelemetry[] = Array.isArray(telemetry)
    ? telemetry
    : [telemetry];
  const logRecords = records.map((record) => {
    const attributes: Record<string, unknown>[] = [
      toOtlpAttribute("fusion.total_adapters", record.totalAdapters),
      toOtlpAttribute("fusion.successful_adapters", record.successfulAdapters),
      toOtlpAttribute("fusion.failed_adapters", record.failedAdapters),
    ];

    record.failures.forEach((failure: TelemetryFailure, index: number) => {
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
      timeUnixNano: `${Date.now()}000000`,
      severityText: "WARN",
      body: { stringValue: "co_failure_telemetry" },
      attributes,
    };
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
            logRecords,
          },
        ],
      },
    ],
  };
}

export function createOtlpHttpTelemetrySink(
  options: OtlpTelemetrySinkOptions,
): TelemetrySink {
  const handler = createOtlpTelemetryHandler(options);
  return (telemetry) => handler([telemetry], { deadlineMs: Date.now() + 500 });
}

export function createOtlpTelemetryHandler(
  options: OtlpTelemetrySinkOptions,
): BufferedBatchHandler<CoFailureTelemetry> {
  const timeoutMs = boundedInteger(
    options.timeoutMs,
    500,
    TELEMETRY_MAX_HTTP_TIMEOUT_MS,
  );
  const endpointRedactionValues = credentialValuesFromUrl(options.endpoint);
  const endpointForDiagnostics = sanitizeDiagnosticText(
    sanitizeEndpointForDiagnostic(options.endpoint),
    endpointRedactionValues,
  );

  return async (records) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    unrefBestEffort(timeoutId);

    let response: Response;
    try {
      response = await fetch(options.endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(options.headers ?? {}),
        },
        signal: controller.signal,
        body: JSON.stringify(
          toOtlpLogPayload(records, options.serviceName ?? "fusion-router"),
        ),
      });
    } catch (error) {
      if (controller.signal.aborted) {
        throw new ProcessExecutionError(
          "timeout",
          `Telemetry sink timed out after ${timeoutMs}ms for ${endpointForDiagnostics}.`,
          { redactionValues: endpointRedactionValues },
        );
      }

      const safeCause = sanitizeDiagnosticText(
        error instanceof Error ? error.message : String(error),
        endpointRedactionValues,
      );
      throw new ProcessExecutionError(
        "telemetry_sink_failed",
        `Telemetry sink request failed for ${endpointForDiagnostics}: ${safeCause}`,
        { redactionValues: endpointRedactionValues },
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      throw new ProcessExecutionError(
        "telemetry_sink_failed",
        `Telemetry sink rejected payload with HTTP ${response.status} for ${endpointForDiagnostics}.`,
        { redactionValues: endpointRedactionValues },
      );
    }
  };
}

function unrefBestEffort(timerId: ReturnType<typeof setTimeout>): void {
  try {
    Deno.unrefTimer(timerId as unknown as number);
  } catch {
    // best effort; older runtimes may not expose timer unref
  }
}

async function awaitWithDeadline<T>(
  operation: T | Promise<T>,
  timeoutMs: number,
): Promise<T> {
  if (timeoutMs <= 0) {
    throw new ProcessExecutionError(
      "timeout",
      "Buffered sink flush deadline exceeded.",
    );
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(
            new ProcessExecutionError(
              "timeout",
              "Buffered sink flush deadline exceeded.",
            ),
          );
        }, timeoutMs);
        unrefBestEffort(timeoutId);
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

function isFlushableTelemetrySink(
  sink: TelemetrySink,
): sink is FlushableTelemetrySink {
  return typeof (sink as Partial<FlushableTelemetrySink>).flush ===
      "function" &&
    typeof (sink as Partial<FlushableTelemetrySink>).close === "function";
}

export async function flushTelemetrySink(
  sink: TelemetrySink | undefined,
  options: TelemetryFlushOptions = {},
): Promise<void> {
  if (sink && isFlushableTelemetrySink(sink)) {
    await sink.flush(options);
  }
}

export async function closeTelemetrySink(
  sink: TelemetrySink | undefined,
  options: TelemetryFlushOptions = {},
): Promise<void> {
  if (sink && isFlushableTelemetrySink(sink)) {
    await sink.close(options);
  }
}

function bufferedSinkError(
  name: string,
  message: string,
): ProcessExecutionError {
  return new ProcessExecutionError(
    "buffered_sink_failed",
    `${name}: ${message}`,
  );
}

export function createBufferedBatchSink<TRecord>(
  handler: BufferedBatchHandler<TRecord>,
  options: BufferedBatchSinkOptions = {},
): BufferedBatchSink<TRecord> {
  const name = options.name ?? "buffered_sink";
  const overflowPolicy = options.overflowPolicy ?? "drop_oldest";
  const deliveryMode = options.deliveryMode ?? "best_effort";
  const maxQueueSize = boundedInteger(
    options.maxQueueSize,
    1_000,
    TELEMETRY_MAX_QUEUE_SIZE,
  );
  const maxBatchSize = boundedInteger(
    options.maxBatchSize,
    30,
    TELEMETRY_MAX_BATCH_SIZE,
  );
  const flushIntervalMs = boundedInteger(
    options.flushIntervalMs,
    500,
    TELEMETRY_MAX_FLUSH_INTERVAL_MS,
  );
  const maxAttempts = boundedInteger(
    options.maxAttempts,
    5,
    TELEMETRY_MAX_ATTEMPTS,
  );
  const baseBackoffMs = boundedInteger(
    options.baseBackoffMs,
    250,
    TELEMETRY_MAX_BASE_BACKOFF_MS,
  );
  const maxBackoffMs = boundedInteger(
    options.maxBackoffMs,
    30_000,
    TELEMETRY_MAX_BACKOFF_MS,
  );
  const backoffMultiplier = Math.max(options.backoffMultiplier ?? 2, 1);
  const defaultDrainMs = boundedInteger(
    options.defaultDrainMs,
    200,
    TELEMETRY_MAX_DRAIN_MS,
  );
  const now = options.now ?? (() => Date.now());

  const queue: Array<BufferedBatchEntry<TRecord> | undefined> = new Array(
    maxQueueSize,
  );
  let queueHead = 0;
  let queueSizeValue = 0;
  let timerId: ReturnType<typeof setTimeout> | undefined;
  let closed = false;
  let flushChain: Promise<void> = Promise.resolve();
  let unloadHandler: (() => void) | undefined;
  const stats = {
    enqueued: 0,
    delivered: 0,
    rejected: 0,
    droppedOldest: 0,
    droppedAfterRetries: 0,
    failedFlushes: 0,
  };

  const queueSize = () => queueSizeValue;
  const queueIndex = (offset: number) => (queueHead + offset) % maxQueueSize;

  const snapshot = (): BufferedBatchSinkStats => ({
    queueSize: queueSize(),
    maxQueueSize,
    enqueued: stats.enqueued,
    delivered: stats.delivered,
    rejected: stats.rejected,
    droppedOldest: stats.droppedOldest,
    droppedAfterRetries: stats.droppedAfterRetries,
    failedFlushes: stats.failedFlushes,
    closed,
  });

  const clearFlushTimer = () => {
    if (timerId !== undefined) {
      clearTimeout(timerId);
      timerId = undefined;
    }
  };

  const removeUnloadHook = () => {
    if (unloadHandler) {
      globalThis.removeEventListener("unload", unloadHandler);
      unloadHandler = undefined;
    }
  };

  const enqueueEntry = (entry: BufferedBatchEntry<TRecord>) => {
    if (queueSizeValue === maxQueueSize) {
      if (overflowPolicy === "fail_closed") {
        stats.rejected += 1;
        throw bufferedSinkError(name, "queue is full");
      }

      queue[queueHead] = entry;
      queueHead = (queueHead + 1) % maxQueueSize;
      stats.droppedOldest += 1;
      return;
    }

    queue[queueIndex(queueSizeValue)] = entry;
    queueSizeValue += 1;
  };

  const resetQueueFrom = (entries: BufferedBatchEntry<TRecord>[]) => {
    queue.fill(undefined);
    queueHead = 0;
    queueSizeValue = entries.length;
    entries.forEach((entry, index) => {
      queue[index] = entry;
    });
  };

  const retryDelayMs = (attempts: number) =>
    Math.min(
      Math.ceil(baseBackoffMs * backoffMultiplier ** Math.max(0, attempts - 1)),
      maxBackoffMs,
    );

  const entriesInOrder = (): BufferedBatchEntry<TRecord>[] => {
    const entries: BufferedBatchEntry<TRecord>[] = [];
    for (let offset = 0; offset < queueSizeValue; offset += 1) {
      const entry = queue[queueIndex(offset)];
      if (entry) {
        entries.push(entry);
      }
    }
    return entries;
  };

  const nextDelayMs = () => {
    if (queueSize() === 0) {
      return flushIntervalMs;
    }

    const nextAttemptAt = Math.min(
      ...entriesInOrder().map((entry) => entry.nextAttemptAt),
    );
    return Math.min(
      flushIntervalMs,
      Math.max(0, nextAttemptAt - now()),
    );
  };

  const scheduleFlush = (delayMs = flushIntervalMs) => {
    if (closed || deliveryMode === "must_accept") {
      return;
    }

    if (timerId !== undefined) {
      if (delayMs > 0) {
        return;
      }
      clearFlushTimer();
    }

    timerId = setTimeout(() => {
      timerId = undefined;
      void sink.flush().catch((error) => {
        console.warn(`${name} buffered flush failure: ${errorMessage(error)}`);
      });
    }, delayMs);
    unrefBestEffort(timerId);
  };

  const planEligibleBatch = (
    force: boolean,
  ): {
    batch: BufferedBatchEntry<TRecord>[];
    remaining: BufferedBatchEntry<TRecord>[];
  } => {
    const batch: BufferedBatchEntry<TRecord>[] = [];
    const remaining: BufferedBatchEntry<TRecord>[] = [];
    const timestamp = now();

    for (const entry of entriesInOrder()) {
      if (
        batch.length < maxBatchSize &&
        (force || entry.nextAttemptAt <= timestamp)
      ) {
        batch.push(entry);
      } else {
        remaining.push(entry);
      }
    }

    return { batch, remaining };
  };

  const selectEligibleBatch = (
    force: boolean,
  ): BufferedBatchEntry<TRecord>[] => {
    const { batch, remaining } = planEligibleBatch(force);
    resetQueueFrom(remaining);
    return batch;
  };

  const peekEligibleBatch = (
    force: boolean,
  ): BufferedBatchEntry<TRecord>[] => planEligibleBatch(force).batch;

  const removeBatchEntries = (
    batch: BufferedBatchEntry<TRecord>[],
  ): void => {
    const selected = new Set(batch);
    resetQueueFrom(entriesInOrder().filter((entry) => !selected.has(entry)));
  };

  const requeueAfterFailure = (
    entries: BufferedBatchEntry<TRecord>[],
    force: boolean,
  ) => {
    for (const entry of entries) {
      const attempts = entry.attempts + 1;
      if (force || attempts >= maxAttempts) {
        stats.droppedAfterRetries += 1;
        continue;
      }

      enqueueEntry({
        record: entry.record,
        attempts,
        nextAttemptAt: now() + retryDelayMs(attempts),
      });
    }
  };

  const prependEntries = (entries: BufferedBatchEntry<TRecord>[]) => {
    resetQueueFrom([...entries, ...entriesInOrder()].slice(0, maxQueueSize));
  };

  const flushBatch = async (
    force: boolean,
    deadline: number,
    throwOnFailure: boolean,
  ): Promise<boolean> => {
    if (now() >= deadline) {
      return false;
    }

    const batch = throwOnFailure
      ? peekEligibleBatch(force)
      : selectEligibleBatch(force);
    if (batch.length === 0) {
      return false;
    }

    if (now() >= deadline) {
      if (!throwOnFailure) {
        prependEntries(batch);
      }
      return false;
    }

    try {
      await awaitWithDeadline(
        handler(
          batch.map((entry) => entry.record),
          { deadlineMs: deadline },
        ),
        deadline - now(),
      );
      if (throwOnFailure) {
        removeBatchEntries(batch);
      }
      stats.delivered += batch.length;
    } catch (error) {
      stats.failedFlushes += 1;
      if (throwOnFailure) {
        throw error;
      }
      requeueAfterFailure(batch, force);
    }

    return true;
  };

  const drain = async (
    options: TelemetryFlushOptions = {},
    throwOnFailure = false,
  ) => {
    const force = options.force ?? false;
    const maxDurationMs = boundedInteger(
      options.maxDurationMs,
      defaultDrainMs,
      TELEMETRY_MAX_DRAIN_MS,
    );
    const deadline = now() + maxDurationMs;

    clearFlushTimer();

    while (queueSize() > 0 && now() < deadline) {
      const progressed = await flushBatch(force, deadline, throwOnFailure);
      if (!progressed) {
        break;
      }

      if (!force) {
        break;
      }
    }

    if (!closed && queueSize() > 0) {
      scheduleFlush(nextDelayMs());
    }
  };

  const runSerialized = async (
    task: () => Promise<void>,
  ): Promise<void> => {
    const previous = flushChain.catch(() => undefined);
    const next = previous.then(task);
    flushChain = next.catch(() => undefined);
    await next;
  };

  const sink = ((record: TRecord) => {
    if (closed) {
      stats.rejected += 1;
      throw bufferedSinkError(name, "sink is closed");
    }

    enqueueEntry({ record, attempts: 0, nextAttemptAt: now() });
    stats.enqueued += 1;

    if (deliveryMode === "must_accept") {
      return sink.flush({ maxDurationMs: defaultDrainMs, force: true });
    }

    scheduleFlush(queueSize() >= maxBatchSize ? 0 : flushIntervalMs);
  }) as BufferedBatchSink<TRecord>;

  sink.flush = async (flushOptions: TelemetryFlushOptions = {}) => {
    const throwOnFailure = deliveryMode === "must_accept";
    await runSerialized(() => drain(flushOptions, throwOnFailure));
  };

  sink.close = async (flushOptions: TelemetryFlushOptions = {}) => {
    closed = true;
    clearFlushTimer();
    removeUnloadHook();
    await runSerialized(() =>
      drain({
        maxDurationMs: flushOptions.maxDurationMs ?? defaultDrainMs,
        force: flushOptions.force ?? true,
      })
    );
  };

  sink.stats = snapshot;

  if (options.registerUnloadHook ?? true) {
    unloadHandler = () => {
      void sink.flush({ maxDurationMs: defaultDrainMs, force: true });
    };
    globalThis.addEventListener("unload", unloadHandler, { once: true });
  }

  return sink;
}

export function createBufferedTelemetrySink(
  downstream: TelemetrySink,
  options: BufferedTelemetrySinkOptions = {},
): FlushableTelemetrySink {
  return createBufferedBatchSink<CoFailureTelemetry>(
    async (records) => {
      for (const telemetry of records) {
        await downstream(telemetry);
      }
    },
    {
      ...options,
      name: options.name ?? "telemetry_sink",
      maxBatchSize: 1,
      overflowPolicy: "drop_oldest",
      deliveryMode: "best_effort",
    },
  );
}

function compactObject(
  value: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  );
}

function toSupabaseAuditRpcRecord(
  record: SupabaseAuditRecord,
): Record<string, unknown> {
  return compactObject({
    event_type: record.eventType,
    actor_type: record.actorType,
    workflow_id: record.workflowId,
    route: record.route,
    decision: record.decision,
    reason: record.reason,
    metadata: record.metadata,
  });
}

export function createSupabaseAuditHandler(
  options: SupabaseAuditHandlerOptions,
): BufferedBatchHandler<SupabaseAuditRecord> {
  const endpoint = new URL(
    "/rest/v1/rpc/insert_workflow_access_audit_batch",
    options.supabaseUrl,
  ).toString();
  const endpointForDiagnostics = sanitizeEndpointForDiagnostic(endpoint);
  const fetchFn = options.fetchFn ?? fetch;
  const timeoutMs = boundedInteger(
    options.timeoutMs,
    5_000,
    TELEMETRY_MAX_HTTP_TIMEOUT_MS,
  );
  const label = "Supabase audit RPC";

  return async (records, context) => {
    const jwt = trimApiKey(options.jwtProvider());
    const anonKey = trimApiKey(options.anonKeyProvider());
    const redactionValues = [
      ...(jwt ? [jwt] : []),
      ...(anonKey ? [anonKey] : []),
      ...credentialValuesFromUrl(endpoint),
    ];

    if (!jwt) {
      throw new ProcessExecutionError(
        "auth_failed",
        `${label} missing user/session JWT.`,
      );
    }

    if (!anonKey) {
      throw new ProcessExecutionError(
        "auth_failed",
        `${label} missing Supabase anon key.`,
      );
    }

    const requestTimeoutMs = Math.max(
      1,
      Math.min(timeoutMs, context.deadlineMs - Date.now()),
    );
    const controller = new AbortController();
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, requestTimeoutMs);
    unrefBestEffort(timeoutId);

    try {
      const response = await fetchFn(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "prefer": "return=minimal",
          "authorization": `Bearer ${jwt}`,
          "apikey": anonKey,
        },
        signal: controller.signal,
        body: JSON.stringify({
          records: records.map(toSupabaseAuditRpcRecord),
        }),
      });

      if (!response.ok) {
        throw await classifyDirectHttpFailure(
          response,
          label,
          redactionValues,
        );
      }
    } catch (error) {
      if (error instanceof ProcessExecutionError) {
        throw error;
      }

      const name = error instanceof Error ? error.name : "";
      if (timedOut || name === "AbortError") {
        throw new ProcessExecutionError(
          timedOut ? "timeout" : "aborted",
          `${label} request ${
            timedOut ? "timed out" : "was aborted"
          } for ${endpointForDiagnostics}.`,
          { cause: error, redactionValues },
        );
      }

      throw classifyProcessFailure(
        `${label} request failed for ${endpointForDiagnostics}: ${
          errorMessage(error)
        }`,
        "",
        "",
        undefined,
        redactionValues,
      );
    } finally {
      clearTimeout(timeoutId);
    }
  };
}

export function createSupabaseAuditSink(
  options: SupabaseAuditSinkOptions,
): BufferedBatchSink<SupabaseAuditRecord> {
  return createBufferedBatchSink<SupabaseAuditRecord>(options.flushHandler, {
    name: "supabase_audit_sink",
    overflowPolicy: "fail_closed",
    deliveryMode: "must_accept",
    ...options,
  });
}

export function createCompositeTelemetrySink(
  ...sinks: TelemetrySink[]
): FlushableTelemetrySink {
  const composite = (async (telemetry: CoFailureTelemetry) => {
    await Promise.all(sinks.map((sink) => sink(telemetry)));
  }) as FlushableTelemetrySink;

  composite.flush = async (options: TelemetryFlushOptions = {}) => {
    await Promise.all(sinks.map((sink) => flushTelemetrySink(sink, options)));
  };

  composite.close = async (options: TelemetryFlushOptions = {}) => {
    await Promise.all(sinks.map((sink) => closeTelemetrySink(sink, options)));
  };

  composite.stats = () => ({
    queueSize: 0,
    maxQueueSize: 0,
    enqueued: 0,
    delivered: 0,
    rejected: 0,
    droppedOldest: 0,
    droppedAfterRetries: 0,
    failedFlushes: 0,
    closed: false,
  });

  return composite;
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
  routingMode?: unknown;
  routingModeEnvProvider?: () => unknown;
};

export type FusionRouterRouteOptions = {
  routingMode?: unknown;
};

export class FusionRouter {
  private readonly modelAdapters: ModelAdapter[];
  private readonly synthesisAdapter: SynthesisAdapter;
  private readonly timeoutMs: number;
  private readonly minSuccessfulAdapters: number;
  private readonly telemetrySink?: TelemetrySink;
  private readonly routingModeConfig?: unknown;
  private readonly routingModeEnvProvider: () => unknown;

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
    this.routingModeConfig = options.routingMode;
    this.routingModeEnvProvider = options.routingModeEnvProvider ??
      readRoutingModeEnv;
  }

  resolveRoutingModeForRequest(
    options: FusionRouterRouteOptions = {},
  ): RoutingModeResolution {
    return parseRoutingMode(options.routingMode, "request") ??
      parseRoutingMode(this.routingModeConfig, "config") ??
      parseRoutingMode(this.routingModeEnvProvider(), "env") ??
      { mode: "direct", source: "default" };
  }

  async flushTelemetry(options: TelemetryFlushOptions = {}): Promise<void> {
    await flushTelemetrySink(this.telemetrySink, options);
  }

  async closeTelemetry(options: TelemetryFlushOptions = {}): Promise<void> {
    await closeTelemetrySink(this.telemetrySink, options);
  }

  async route(
    prompt: string,
    options: FusionRouterRouteOptions = {},
  ): Promise<FinalSynthesis> {
    const routingMode = this.resolveRoutingModeForRequest(options);
    assertImplementedRoutingMode(routingMode);

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

  const otlpHandler = createOtlpTelemetryHandler({
    endpoint,
    serviceName: "fusion-router",
    timeoutMs: boundedEnvInteger(
      "FUSION_ROUTER_TELEMETRY_HTTP_TIMEOUT_MS",
      500,
      TELEMETRY_MAX_HTTP_TIMEOUT_MS,
    ),
  });

  return createBufferedBatchSink(otlpHandler, {
    name: "otlp_telemetry",
    maxQueueSize: boundedEnvInteger(
      "FUSION_ROUTER_TELEMETRY_MAX_QUEUE",
      1_000,
      TELEMETRY_MAX_QUEUE_SIZE,
    ),
    maxBatchSize: boundedEnvInteger(
      "FUSION_ROUTER_TELEMETRY_MAX_BATCH",
      30,
      TELEMETRY_MAX_BATCH_SIZE,
    ),
    flushIntervalMs: boundedEnvInteger(
      "FUSION_ROUTER_TELEMETRY_FLUSH_INTERVAL_MS",
      500,
      TELEMETRY_MAX_FLUSH_INTERVAL_MS,
    ),
    maxAttempts: boundedEnvInteger(
      "FUSION_ROUTER_TELEMETRY_MAX_ATTEMPTS",
      5,
      TELEMETRY_MAX_ATTEMPTS,
    ),
    baseBackoffMs: boundedEnvInteger(
      "FUSION_ROUTER_TELEMETRY_BASE_BACKOFF_MS",
      250,
      TELEMETRY_MAX_BASE_BACKOFF_MS,
    ),
    maxBackoffMs: boundedEnvInteger(
      "FUSION_ROUTER_TELEMETRY_MAX_BACKOFF_MS",
      30_000,
      TELEMETRY_MAX_BACKOFF_MS,
    ),
    defaultDrainMs: boundedEnvInteger(
      "FUSION_ROUTER_TELEMETRY_DRAIN_MS",
      200,
      TELEMETRY_MAX_DRAIN_MS,
    ),
    registerUnloadHook: !envFlagEnabled(
      "FUSION_ROUTER_TELEMETRY_DISABLE_UNLOAD_HOOK",
    ),
  });
}

function envFlagEnabled(name: string): boolean {
  return Deno.env.get(name) === "1" ||
    Deno.env.get(name)?.toLowerCase() === "true";
}

function createDefaultDirectHttpAdapters(): ModelAdapter[] {
  const adapters: ModelAdapter[] = [];

  if (trimApiKey(Deno.env.get("OPENAI_API_KEY"))) {
    adapters.push(
      createOpenAIDirectAdapter({
        budgetManager: new InMemoryBudgetManager(0.2),
      }),
    );
  }

  if (trimApiKey(Deno.env.get("ANTHROPIC_API_KEY"))) {
    adapters.push(
      createAnthropicDirectAdapter({
        budgetManager: new InMemoryBudgetManager(0.2),
      }),
    );
  }

  return adapters;
}

function createDefaultCliAdapters(): ModelAdapter[] {
  return [
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
  ];
}

function createDefaultRouter(): FusionRouter {
  const envTelemetrySink = maybeCreateEnvTelemetrySink();
  const telemetrySink = envTelemetrySink
    ? createCompositeTelemetrySink(consoleTelemetrySink, envTelemetrySink)
    : consoleTelemetrySink;
  const directOnly = envFlagEnabled("FUSION_ROUTER_DIRECT_HTTP_ONLY");
  const directHttpEnabled = directOnly ||
    envFlagEnabled("FUSION_ROUTER_ENABLE_DIRECT_HTTP");
  const directAdapters = directHttpEnabled
    ? createDefaultDirectHttpAdapters()
    : [];
  const cliAdapters = directOnly ? [] : createDefaultCliAdapters();
  const modelAdapters = [...directAdapters, ...cliAdapters];

  if (directOnly && !trimApiKey(Deno.env.get("OPENAI_API_KEY"))) {
    throw new Error(
      "FUSION_ROUTER_DIRECT_HTTP_ONLY requires OPENAI_API_KEY for direct HTTP synthesis.",
    );
  }

  const synthesisAdapter = directOnly
    ? createOpenAIDirectSynthesisAdapter({
      budgetManager: new InMemoryBudgetManager(0.25),
    })
    : createCodexStructuredSynthesisAdapter({
      budgetManager: new InMemoryBudgetManager(0.25),
    });

  return new FusionRouter({
    timeoutMs: 120_000,
    minSuccessfulAdapters: Math.min(2, modelAdapters.length),
    telemetrySink,
    modelAdapters,
    synthesisAdapter,
  });
}

if (import.meta.main) {
  let router: FusionRouter | undefined;

  try {
    router = createDefaultRouter();
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
  } finally {
    await router?.closeTelemetry({
      maxDurationMs: boundedEnvInteger(
        "FUSION_ROUTER_TELEMETRY_DRAIN_MS",
        200,
        TELEMETRY_MAX_DRAIN_MS,
      ),
      force: true,
    }).catch((error) => {
      console.warn(`Telemetry shutdown drain failure: ${errorMessage(error)}`);
    });
  }
}
