import type { BudgetManager } from "./budget/budget.ts";
import {
  type AgentRuntimeConfig,
  runAgentRuntime,
} from "./agent-runtime/index.ts";
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
import type { ProviderDescriptor } from "./schemas.ts";
import type {
  DirectRoutingDecision,
  DirectRoutingPolicy,
  DirectRoutingPolicyInput,
} from "./policy/direct-routing-policy.ts";
import type { ProviderCapabilityRegistry } from "./policy/provider-registry.ts";
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

function providerDescriptorSelectionKey(
  descriptor: ProviderDescriptor,
): string {
  return [
    descriptor.provider,
    descriptor.model,
    descriptor.authMode,
    descriptor.transport,
    descriptor.client ?? "",
  ].map((part) => part.toLowerCase()).join("\u0000");
}

export type QuorumRouterOptions = {
  modelAdapters: ModelAdapter[];
  synthesisAdapter: SynthesisAdapter;
  timeoutMs?: number;
  minSuccessfulAdapters?: number;
  telemetrySink?: TelemetrySink;
  routingMode?: unknown;
  routingModeEnvProvider?: () => unknown;
  directRoutingPolicy?: DirectRoutingPolicy;
  providerRegistry?: ProviderCapabilityRegistry;
  providerReadinessHints?: DirectRoutingPolicyInput["readinessHints"];
  directRoutingBudgetManager?: BudgetManager;
  agentRuntime?: AgentRuntimeConfig;
};

export type QuorumRouterRouteOptions = {
  routingMode?: unknown;
  providerReadinessHints?: DirectRoutingPolicyInput["readinessHints"];
  directRoutingBudgetManager?: BudgetManager;
  experimentalAgentRuntime?: boolean;
};

export class QuorumRouter {
  private readonly modelAdapters: ModelAdapter[];
  private readonly synthesisAdapter: SynthesisAdapter;
  private readonly timeoutMs: number;
  private readonly minSuccessfulAdapters: number;
  private readonly telemetrySink?: TelemetrySink;
  private readonly routingModeConfig?: unknown;
  private readonly routingModeEnvProvider: () => unknown;
  private readonly directRoutingPolicy?: DirectRoutingPolicy;
  private readonly providerRegistry?: ProviderCapabilityRegistry;
  private readonly providerReadinessHints?:
    DirectRoutingPolicyInput["readinessHints"];
  private readonly directRoutingBudgetManager?: BudgetManager;
  private readonly agentRuntime?: AgentRuntimeConfig;

  constructor(options: QuorumRouterOptions) {
    if (options.modelAdapters.length === 0) {
      throw new Error("QuorumRouter requires at least one model adapter.");
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
    this.directRoutingPolicy = options.directRoutingPolicy;
    this.providerRegistry = options.providerRegistry;
    this.providerReadinessHints = options.providerReadinessHints;
    this.directRoutingBudgetManager = options.directRoutingBudgetManager;
    this.agentRuntime = options.agentRuntime;
  }

  resolveRoutingModeForRequest(
    options: QuorumRouterRouteOptions = {},
  ): RoutingModeResolution {
    return parseRoutingMode(options.routingMode, "request") ??
      parseRoutingMode(this.routingModeConfig, "config") ??
      parseRoutingMode(this.routingModeEnvProvider(), "env") ??
      { mode: "direct", source: "default" };
  }

  describeRoutingModeDecisionForRequest(
    options: QuorumRouterRouteOptions = {},
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

  private resolveDirectRoutingDecision(
    options: QuorumRouterRouteOptions = {},
  ): DirectRoutingDecision | undefined {
    return this.directRoutingPolicy?.decide({
      candidates: this.modelAdapters.map((adapter) => adapter.descriptor),
      synthesisCandidates: [this.synthesisAdapter.descriptor],
      providerRegistry: this.providerRegistry,
      readinessHints: options.providerReadinessHints ??
        this.providerReadinessHints,
      budgetManager: options.directRoutingBudgetManager ??
        this.directRoutingBudgetManager,
    });
  }

  private selectAdaptersForDecision(
    decision: DirectRoutingDecision | undefined,
  ): ModelAdapter[] {
    if (!decision) {
      return this.modelAdapters;
    }

    const selectedKeys = new Set(
      decision.selectedAdapters.map(providerDescriptorSelectionKey),
    );
    return this.modelAdapters.filter((adapter) =>
      selectedKeys.has(providerDescriptorSelectionKey(adapter.descriptor))
    );
  }

  async routeAgentRuntime(
    prompt: string,
    options: QuorumRouterRouteOptions = {},
  ) {
    if (
      !this.agentRuntime?.execution && options.experimentalAgentRuntime !== true
    ) {
      failClosed(
        4401,
        "agent_runtime_opt_in_required",
        "agent_chat requires experimentalAgentRuntime=true before AgentRuntime execution.",
      );
    }
    if (!this.agentRuntime || this.agentRuntime.enabled !== true) {
      failClosed(
        4401,
        "agent_runtime_config_required",
        "agent_chat requires an enabled AgentRuntime config.",
      );
    }
    if (
      !this.agentRuntime.execution && this.agentRuntime.experimental !== true
    ) {
      failClosed(
        4401,
        "agent_runtime_experimental_required",
        "AgentRuntime config must be marked experimental=true.",
      );
    }
    return await runAgentRuntime({
      prompt,
      config: this.agentRuntime,
    });
  }

  async route(
    prompt: string,
    options: QuorumRouterRouteOptions = {},
  ): Promise<FinalSynthesis> {
    const routingMode = this.describeRoutingModeDecisionForRequest(options);
    if (routingMode.mode === "agent_chat") {
      const runtimeResult = await this.routeAgentRuntime(prompt, options);
      if (!runtimeResult.ok || !runtimeResult.finalAnswer) {
        failClosed(
          4401,
          "agent_runtime_not_ready",
          "AgentRuntime completed without a ready final answer.",
          {
            decision: runtimeResult.decision.decision,
            objections: runtimeResult.runtimeSummary.objections,
            turns: runtimeResult.runtimeSummary.turns,
          },
        );
      }
      return FinalSynthesisSchema.parse({
        synthesis: runtimeResult.finalAnswer,
        reasoning: runtimeResult.decision.reason,
        consensusModel: "AgentRuntime/experimental",
        sources: runtimeResult.transcript.turns.map((turn) =>
          `${String(turn.metadata.provider)}/${String(turn.metadata.model)}`
        ),
      });
    }
    assertImplementedRoutingMode(routingMode);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      console.log("Starting parallel model execution...");
      const directRoutingDecision = this.resolveDirectRoutingDecision(options);
      const executionAdapters = this.selectAdaptersForDecision(
        directRoutingDecision,
      );
      const effectiveMinSuccessfulAdapters = Math.min(
        this.minSuccessfulAdapters,
        executionAdapters.length,
      );
      if (effectiveMinSuccessfulAdapters < 1) {
        failClosed(
          4401,
          "consensus_insufficient",
          "Validated quorum not met: direct routing policy selected no executable adapters.",
          {
            routingMode,
            directRoutingDecision,
            configuredMinSuccessfulAdapters: this.minSuccessfulAdapters,
            effectiveMinSuccessfulAdapters,
          },
        );
      }

      const settled = await Promise.allSettled(
        executionAdapters.map((adapter) =>
          adapter.invoke(prompt, controller.signal)
        ),
      );

      const telemetry = buildCoFailureTelemetry(executionAdapters, settled);
      if (telemetry.failedAdapters > 0) {
        void publishTelemetryBestEffort(this.telemetrySink, telemetry);
      }

      const successfulOutputs = settled
        .filter((result): result is PromiseFulfilledResult<ModelOutput> =>
          result.status === "fulfilled"
        )
        .map((result) => result.value);

      if (successfulOutputs.length < effectiveMinSuccessfulAdapters) {
        failClosed(
          4401,
          "consensus_insufficient",
          `Validated quorum not met: required ${effectiveMinSuccessfulAdapters}, got ${successfulOutputs.length}.`,
          {
            routingMode,
            telemetry,
            directRoutingDecision,
            configuredMinSuccessfulAdapters: this.minSuccessfulAdapters,
            effectiveMinSuccessfulAdapters,
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
            directRoutingDecision,
          },
        );
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

/** @deprecated Use QuorumRouterOptions. */
export type FusionRouterOptions = QuorumRouterOptions;
/** @deprecated Use QuorumRouterRouteOptions. */
export type FusionRouterRouteOptions = QuorumRouterRouteOptions;
/** @deprecated Use QuorumRouter. */
export { QuorumRouter as FusionRouter };
