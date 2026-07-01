import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

/**
 * Fusion Router PoC
 *
 * Goals:
 * 1. Fan out to multiple adapters in parallel.
 * 2. Validate every adapter response with Zod.
 * 3. Fail closed when validated quorum is not met.
 * 4. Record co-failure telemetry.
 * 5. Pass validated outputs to a stronger consensus model (e.g. GPT-5.5).
 *
 * NOTE: This file intentionally ships mock adapters. It models the architecture
 * for direct API providers, OAuth-backed wrapper clients (e.g. zcodeWrapper),
 * and custom adapter surfaces such as local/session-backed tools.
 * without baking in any one vendor SDK.
 */

const AuthModeSchema = z.enum(["apiKey", "oauth", "session"]);
const TransportSchema = z.enum(["directApi", "zcodeWrapper", "customAdapter"]);

const ProviderDescriptorSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  authMode: AuthModeSchema,
  transport: TransportSchema,
  client: z.string().min(1).optional(),
});

type ProviderDescriptor = z.infer<typeof ProviderDescriptorSchema>;

const ModelOutputSchema = z.object({
  content: z.string().min(1),
  model: z.string().min(1),
  provider: z.string().min(1),
  latencyMs: z.number().nonnegative(),
});

type ModelOutput = z.infer<typeof ModelOutputSchema>;

const FinalSynthesisSchema = z.object({
  synthesis: z.string().min(1),
  reasoning: z.string().min(1),
  consensusModel: z.string().min(1),
  sources: z.array(z.string().min(1)).min(1),
});

type FinalSynthesis = z.infer<typeof FinalSynthesisSchema>;

const TelemetryFailureSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  code: z.string().min(1),
  message: z.string().min(1),
});

type TelemetryFailure = z.infer<typeof TelemetryFailureSchema>;

const CoFailureTelemetrySchema = z.object({
  totalAdapters: z.number().int().nonnegative(),
  successfulAdapters: z.number().int().nonnegative(),
  failedAdapters: z.number().int().nonnegative(),
  failures: z.array(TelemetryFailureSchema),
});

type CoFailureTelemetry = z.infer<typeof CoFailureTelemetrySchema>;

export class RouterError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "RouterError";
    this.status = status;
    this.code = code;
    this.details = details;
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

  return "adapter_failed";
}

async function sleepWithAbort(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    throw new Error("Request aborted before adapter execution.");
  }

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      reject(new Error("Request aborted or timed out."));
    };

    signal.addEventListener("abort", onAbort, { once: true });
  });
}

async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await new Promise<T>((resolve, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`${label} timed out after ${timeoutMs}ms.`));
      }, timeoutMs);

      operation.then(resolve).catch(reject);
    });
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

async function invokeAdapterSafely(
  adapter: ModelAdapter,
  prompt: string,
  signal: AbortSignal,
  timeoutMs: number,
): Promise<ModelOutput> {
  const label = `${adapter.descriptor.provider}/${adapter.descriptor.model}`;
  const output = await withTimeout(
    Promise.resolve().then(() => adapter.invoke(prompt, signal)),
    timeoutMs,
    label,
  );

  return ModelOutputSchema.parse(output);
}

async function publishTelemetryBestEffort(
  telemetrySink: TelemetrySink | undefined,
  telemetry: CoFailureTelemetry,
): Promise<void> {
  if (!telemetrySink) {
    return;
  }

  try {
    await withTimeout(
      Promise.resolve().then(() => telemetrySink(telemetry)),
      500,
      "Telemetry sink",
    );
  } catch (error) {
    console.warn(`Telemetry sink failure: ${errorMessage(error)}`);
  }
}

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

type TelemetrySink = (telemetry: CoFailureTelemetry) => void | Promise<void>;

type MockAdapterOptions = ProviderDescriptor & {
  mockLatencyMs?: number;
  mockResponsePrefix?: string;
  shouldFail?: boolean;
  invalidShape?: boolean;
};

class MockModelAdapter implements ModelAdapter {
  readonly descriptor: ProviderDescriptor;
  private readonly mockLatencyMs: number;
  private readonly mockResponsePrefix: string;
  private readonly shouldFail: boolean;
  private readonly invalidShape: boolean;

  constructor(options: MockAdapterOptions) {
    this.descriptor = ProviderDescriptorSchema.parse(options);
    this.mockLatencyMs = options.mockLatencyMs ?? 150;
    this.mockResponsePrefix = options.mockResponsePrefix ?? "Draft response";
    this.shouldFail = options.shouldFail ?? false;
    this.invalidShape = options.invalidShape ?? false;
  }

  async invoke(prompt: string, signal: AbortSignal): Promise<ModelOutput> {
    const start = Date.now();
    await sleepWithAbort(this.mockLatencyMs, signal);

    if (this.shouldFail) {
      throw new Error(
        `${this.descriptor.provider}/${this.descriptor.model} simulated upstream failure.`,
      );
    }

    if (this.invalidShape) {
      return ModelOutputSchema.parse({
        content: "",
        model: this.descriptor.model,
        provider: this.descriptor.provider,
        latencyMs: Date.now() - start,
      });
    }

    return ModelOutputSchema.parse({
      content:
        `${this.mockResponsePrefix} from ${this.descriptor.provider}/${this.descriptor.model} ` +
        `for prompt: "${prompt.slice(0, 48)}..."`,
      model: this.descriptor.model,
      provider: this.descriptor.provider,
      latencyMs: Date.now() - start,
    });
  }
}

class MockSynthesisAdapter implements SynthesisAdapter {
  readonly descriptor: ProviderDescriptor;

  constructor(descriptor: ProviderDescriptor) {
    this.descriptor = ProviderDescriptorSchema.parse(descriptor);
  }

  async synthesize(
    prompt: string,
    outputs: ModelOutput[],
    signal: AbortSignal,
  ): Promise<FinalSynthesis> {
    await sleepWithAbort(120, signal);

    return FinalSynthesisSchema.parse({
      synthesis:
        `Consensus for: "${prompt}"\n\n` +
        outputs.map((output, index) => `${index + 1}. ${output.content}`).join("\n"),
      reasoning:
        `Validated ${outputs.length} upstream outputs, then synthesized with ` +
        `${this.descriptor.provider}/${this.descriptor.model}.`,
      consensusModel: `${this.descriptor.provider}/${this.descriptor.model}`,
      sources: outputs.map((output) => `${output.provider}/${output.model}`),
    });
  }
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

export function createMockAdapter(options: MockAdapterOptions): ModelAdapter {
  return new MockModelAdapter(options);
}

export function createMockSynthesisAdapter(
  descriptor: ProviderDescriptor,
): SynthesisAdapter {
  return new MockSynthesisAdapter(descriptor);
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
    this.timeoutMs = options.timeoutMs ?? 5000;
    this.minSuccessfulAdapters = Math.max(
      1,
      options.minSuccessfulAdapters ?? Math.min(2, options.modelAdapters.length),
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
          invokeAdapterSafely(
            adapter,
            prompt,
            controller.signal,
            this.timeoutMs,
          )
        ),
      );

      const telemetry = buildCoFailureTelemetry(this.modelAdapters, settled);
      if (telemetry.failedAdapters > 0) {
        void publishTelemetryBestEffort(this.telemetrySink, telemetry);
      }

      const successfulOutputs = settled
        .filter((result): result is PromiseFulfilledResult<ModelOutput> => result.status === "fulfilled")
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

// --- Example Usage ---

if (import.meta.main) {
  const router = new FusionRouter({
    timeoutMs: 3000,
    minSuccessfulAdapters: 2,
    telemetrySink: consoleTelemetrySink,
    modelAdapters: [
      createMockAdapter({
        provider: "OpenAI",
        model: "gpt-4.1-mini",
        authMode: "apiKey",
        transport: "directApi",
        mockResponsePrefix: "Structured answer",
      }),
      createMockAdapter({
        provider: "Anthropic",
        model: "claude-sonnet-4",
        authMode: "apiKey",
        transport: "directApi",
      }),
      createMockAdapter({
        provider: "DeepSeek",
        model: "deepseek-chat",
        authMode: "apiKey",
        transport: "directApi",
      }),
      createMockAdapter({
        provider: "GLM",
        model: "glm-5.2",
        authMode: "oauth",
        transport: "zcodeWrapper",
        client: "Zcode",
      }),
      createMockAdapter({
        provider: "xAI",
        model: "grok-4",
        authMode: "apiKey",
        transport: "directApi",
      }),
      createMockAdapter({
        provider: "Google",
        model: "gemini-2.5-pro",
        authMode: "apiKey",
        transport: "directApi",
      }),
      createMockAdapter({
        provider: "Anthropic",
        model: "claude-opus-4.1",
        authMode: "apiKey",
        transport: "directApi",
      }),
      createMockAdapter({
        provider: "Cognition",
        model: "devin",
        authMode: "session",
        transport: "customAdapter",
        client: "Devin",
      }),
      createMockAdapter({
        provider: "Cline",
        model: "claude-sonnet-4",
        authMode: "session",
        transport: "customAdapter",
        client: "Cline",
        // Intentional demo failure so the sample run still exercises
        // co-failure telemetry and bounded partial-failure handling.
        shouldFail: true,
      }),
    ],
    synthesisAdapter: createMockSynthesisAdapter({
      provider: "OpenAI",
      model: "gpt-5.5",
      authMode: "apiKey",
      transport: "directApi",
    }),
  });

  try {
    const result = await router.route(
      "Explain the impact of quantum computing on encryption.",
    );
    console.log("\n--- Final Synthesis Result ---");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    if (error instanceof RouterError) {
      console.error(`Router Error [${error.status}/${error.code}]: ${error.message}`);
      console.error(JSON.stringify(error.details, null, 2));
    } else if (error instanceof Error) {
      console.error("Router Error:", error.message);
    } else {
      console.error("Router Error:", String(error));
    }
  }
}
