import type { BudgetManager } from "./budget/budget.ts";
import {
  aggregateHierarchicalTaskCalibration,
  aggregateTaskCalibration,
  type HierarchicalTaskCalibrationDecision,
  type HierarchicalTaskCalibrationQuery,
  resolveHierarchicalTaskCalibration,
  type TaskCalibrationOptions,
  type TaskCalibrationReport,
} from "./calibration/calibration.ts";
import {
  type AgentRuntimeConfig,
  runAgentRuntime,
} from "./agent-runtime/index.ts";
import {
  type CoFailureTelemetry,
  type DecisionFailure,
  type DecisionOutcome,
  type DecisionReport,
  type DecisionReportEnvelope,
  DecisionReportEnvelopeSchema,
  DecisionReportSchema,
  type FinalSynthesis,
  FinalSynthesisSchema,
  type ModelOutput,
  ModelOutputSchema,
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

function validateAdapterOutputIdentity(
  adapter: ModelAdapter,
  rawOutput: unknown,
): ModelOutput {
  const output = ModelOutputSchema.parse(rawOutput);
  if (
    output.provider !== adapter.descriptor.provider ||
    output.model !== adapter.descriptor.model
  ) {
    failClosed(
      4401,
      "provider_identity_mismatch",
      "Adapter output identity does not match its configured descriptor.",
      {
        configuredProvider: adapter.descriptor.provider,
        configuredModel: adapter.descriptor.model,
      },
    );
  }
  return output;
}

function decisionFailuresFromTelemetry(
  telemetry: CoFailureTelemetry,
): DecisionFailure[] {
  return telemetry.failures.map((failure) => ({
    stage: "adapter_execution",
    provider: failure.provider,
    model: failure.model,
    code: failure.code,
  }));
}

function buildDecisionReport(args: {
  outcome: DecisionOutcome;
  stage: DecisionReport["stage"];
  configuredRequired: number;
  effectiveRequired: number;
  attemptedAdapters: number;
  successfulOutputs: ModelOutput[];
  failedAdapters: number;
  failures?: DecisionFailure[];
  calibration?: TaskCalibrationReport;
  hierarchicalCalibration?: HierarchicalTaskCalibrationDecision;
}): DecisionReport {
  return DecisionReportSchema.parse({
    schema_version: "quorum-router.decision-report.v1",
    outcome: args.outcome,
    stage: args.stage,
    quorum: {
      configured_required: args.configuredRequired,
      effective_required: args.effectiveRequired,
      validated_outputs: args.successfulOutputs.length,
    },
    execution: {
      attempted_adapters: args.attemptedAdapters,
      successful_adapters: args.successfulOutputs.length,
      failed_adapters: args.failedAdapters,
    },
    validated_sources: args.successfulOutputs.map((output) =>
      `${output.provider}/${output.model}`
    ),
    failures: args.failures ?? [],
    ...(args.calibration ? { calibration: args.calibration } : {}),
    ...(args.hierarchicalCalibration
      ? { hierarchical_calibration: args.hierarchicalCalibration }
      : {}),
  });
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
  calibration?: {
    observations: readonly unknown[];
    options?: TaskCalibrationOptions;
  };
  hierarchicalCalibration?: {
    observations: readonly unknown[];
    options?: TaskCalibrationOptions;
    query: HierarchicalTaskCalibrationQuery;
  };
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
        consensusModel: this.agentRuntime?.execution
          ? "AgentRuntime/SafeLoop"
          : "AgentRuntime/conversation-only",
        sources: runtimeResult.transcript.turns.map((turn) =>
          `${String(turn.metadata.provider)}/${String(turn.metadata.model)}`
        ),
      });
    }
    assertImplementedRoutingMode(routingMode);
    return (await this.routeDirectWithDecisionReport(prompt, options)).final;
  }

  async routeWithDecisionReport(
    prompt: string,
    options: QuorumRouterRouteOptions = {},
  ): Promise<DecisionReportEnvelope> {
    const routingMode = this.describeRoutingModeDecisionForRequest(options);
    if (routingMode.mode !== "direct") {
      failClosed(
        4401,
        "decision_report_direct_mode_required",
        "routeWithDecisionReport currently supports direct routing only.",
        { routingMode },
      );
    }
    assertImplementedRoutingMode(routingMode);
    return await this.routeDirectWithDecisionReport(prompt, options);
  }

  private async routeDirectWithDecisionReport(
    prompt: string,
    options: QuorumRouterRouteOptions,
  ): Promise<DecisionReportEnvelope> {
    if (options.calibration && options.hierarchicalCalibration) {
      failClosed(
        4400,
        "ambiguous_calibration_input",
        "Flat and hierarchical calibration inputs are mutually exclusive.",
      );
    }
    let calibration: TaskCalibrationReport | undefined;
    if (options.calibration) {
      try {
        calibration = aggregateTaskCalibration(
          options.calibration.observations,
          options.calibration.options,
        );
      } catch {
        failClosed(
          4400,
          "calibration_validation_failed",
          "Calibration evidence failed validation.",
        );
      }
    }
    let hierarchicalCalibration:
      | HierarchicalTaskCalibrationDecision
      | undefined;
    if (options.hierarchicalCalibration) {
      try {
        const report = aggregateHierarchicalTaskCalibration(
          options.hierarchicalCalibration.observations,
          options.hierarchicalCalibration.options,
        );
        hierarchicalCalibration = {
          report,
          selection: resolveHierarchicalTaskCalibration(
            report,
            options.hierarchicalCalibration.query,
          ),
        };
      } catch {
        failClosed(
          4400,
          "hierarchical_calibration_validation_failed",
          "Hierarchical calibration evidence failed validation.",
        );
      }
    }
    const routingMode = this.describeRoutingModeDecisionForRequest(options);
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
        const decisionReport = buildDecisionReport({
          outcome: "no_executable_adapters",
          stage: "candidate_selection",
          configuredRequired: this.minSuccessfulAdapters,
          effectiveRequired: effectiveMinSuccessfulAdapters,
          attemptedAdapters: 0,
          successfulOutputs: [],
          failedAdapters: 0,
          calibration,
          hierarchicalCalibration,
        });
        failClosed(
          4401,
          "consensus_insufficient",
          "Validated quorum not met: direct routing policy selected no executable adapters.",
          {
            routingMode,
            directRoutingDecision,
            configuredMinSuccessfulAdapters: this.minSuccessfulAdapters,
            effectiveMinSuccessfulAdapters,
            decisionReport,
          },
        );
      }

      const settled = await Promise.allSettled(
        executionAdapters.map(async (adapter) =>
          validateAdapterOutputIdentity(
            adapter,
            await adapter.invoke(prompt, controller.signal),
          )
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
        const decisionReport = buildDecisionReport({
          outcome: "insufficient_valid_outputs",
          stage: "candidate_execution",
          configuredRequired: this.minSuccessfulAdapters,
          effectiveRequired: effectiveMinSuccessfulAdapters,
          attemptedAdapters: executionAdapters.length,
          successfulOutputs,
          failedAdapters: telemetry.failedAdapters,
          failures: decisionFailuresFromTelemetry(telemetry),
          calibration,
          hierarchicalCalibration,
        });
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
            decisionReport,
          },
        );
      }

      console.log(
        `Received ${successfulOutputs.length} validated responses. Synthesizing with ${this.synthesisAdapter.descriptor.provider}/${this.synthesisAdapter.descriptor.model}...`,
      );

      try {
        const final = FinalSynthesisSchema.parse(
          await this.synthesisAdapter.synthesize(
            prompt,
            successfulOutputs,
            controller.signal,
          ),
        );
        const validatedSourceLabels = new Set(
          successfulOutputs.map((output) =>
            `${output.provider}/${output.model}`
          ),
        );
        if (
          new Set(final.sources).size !== final.sources.length ||
          final.sources.some((source) => !validatedSourceLabels.has(source))
        ) {
          throw new Error(
            "Synthesis sources must be unique and reference only validated candidate outputs.",
          );
        }
        const decisionReport = buildDecisionReport({
          outcome: "minimum_valid_outputs_synthesized",
          stage: "synthesis",
          configuredRequired: this.minSuccessfulAdapters,
          effectiveRequired: effectiveMinSuccessfulAdapters,
          attemptedAdapters: executionAdapters.length,
          successfulOutputs,
          failedAdapters: telemetry.failedAdapters,
          failures: decisionFailuresFromTelemetry(telemetry),
          calibration,
          hierarchicalCalibration,
        });
        return DecisionReportEnvelopeSchema.parse({
          final,
          decision_report: decisionReport,
        });
      } catch (error) {
        const decisionReport = buildDecisionReport({
          outcome: "synthesis_failed",
          stage: "synthesis",
          configuredRequired: this.minSuccessfulAdapters,
          effectiveRequired: effectiveMinSuccessfulAdapters,
          attemptedAdapters: executionAdapters.length,
          successfulOutputs,
          failedAdapters: telemetry.failedAdapters,
          failures: [
            ...decisionFailuresFromTelemetry(telemetry),
            {
              stage: "synthesis",
              provider: this.synthesisAdapter.descriptor.provider,
              model: this.synthesisAdapter.descriptor.model,
              code: "synthesis_failed",
            },
          ],
          calibration,
          hierarchicalCalibration,
        });
        failClosed(
          4401,
          "consensus_validation_failed",
          "Consensus stage failed validation.",
          {
            cause: errorMessage(error),
            routingMode,
            telemetry,
            directRoutingDecision,
            decisionReport,
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
