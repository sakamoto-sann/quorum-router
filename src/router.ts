import {
  type CoFailureTelemetry,
  type FinalSynthesis,
  FinalSynthesisSchema,
  type ModelOutput,
} from "./schemas.ts";
import type {
  ModelAdapter,
  SynthesisAdapter,
  TelemetrySink,
} from "./contracts.ts";
import { errorMessage, failClosed } from "./errors.ts";
import {
  assertImplementedRoutingMode,
  describeRoutingModeDecision,
  parseRoutingMode,
  readRoutingModeEnv,
  type RoutingModeDecision,
  type RoutingModeResolution,
} from "./routing-mode.ts";
import { buildCoFailureTelemetry } from "./telemetry/cofailure.ts";
import {
  closeTelemetrySink,
  flushTelemetrySink,
  type TelemetryFlushOptions,
} from "./telemetry/buffered-batch-sink.ts";

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

    const defaultMinSuccessfulAdapters = Math.min(
      2,
      options.modelAdapters.length,
    );
    const requestedMinSuccessfulAdapters = options.minSuccessfulAdapters ??
      defaultMinSuccessfulAdapters;
    if (
      !Number.isInteger(requestedMinSuccessfulAdapters) ||
      requestedMinSuccessfulAdapters < 1
    ) {
      throw new Error("minSuccessfulAdapters must be an integer >= 1.");
    }

    this.modelAdapters = options.modelAdapters;
    this.synthesisAdapter = options.synthesisAdapter;
    this.timeoutMs = options.timeoutMs ?? 120_000;
    this.minSuccessfulAdapters = requestedMinSuccessfulAdapters;

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

  describeRoutingModeDecisionForRequest(
    options: FusionRouterRouteOptions = {},
  ): RoutingModeDecision {
    return describeRoutingModeDecision(
      this.resolveRoutingModeForRequest(options),
    );
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
    const routingMode = this.describeRoutingModeDecisionForRequest(options);
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
          {
            routingMode,
            telemetry,
          },
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
            routingMode,
            telemetry,
          },
        );
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
