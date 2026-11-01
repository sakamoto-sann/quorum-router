import type { BudgetManager } from "./budget/budget.ts";
import {
  aggregateHierarchicalTaskCalibration,
  aggregateTaskCalibration,
  type HierarchicalCalibrationDriftGuardOptions,
  type HierarchicalTaskCalibrationAnyDecision,
  type HierarchicalTaskCalibrationQuery,
  resolveHierarchicalTaskCalibration,
  resolveHierarchicalTaskCalibrationWithDriftGuard,
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
  type DecisionReportAny,
  DecisionReportAnySchema,
  type DecisionReportEnvelope,
  type DecisionReportEnvelopeAny,
  DecisionReportEnvelopeAnySchema,
  type DecisionReportEnvelopeWithGuardedCalibration,
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
import {
  errorCode,
  errorMessage,
  failClosed,
  ProcessExecutionError,
} from "./errors.ts";
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

/** Receives the router's progress messages. */
export type RouterLogger = {
  info(message: string): void;
};

const consoleRouterLogger: RouterLogger = {
  info: (message) => console.log(message),
};

/** Logger that drops all router progress messages. */
export const silentRouterLogger: RouterLogger = {
  info: () => {},
};

function requireIntegerAtLeast(
  name: string,
  value: number,
  minimum: number,
): number {
  if (!Number.isInteger(value) || value < minimum) {
    throw new Error(`${name} must be an integer >= ${minimum}.`);
  }
  return value;
}

/**
 * Runs `run` with its own abort signal and a hard deadline. The returned
 * promise rejects at the deadline even if `run` ignores the signal.
 */
async function runWithDeadline<T>(
  run: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  timeoutError: () => Error,
): Promise<T> {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      const error = timeoutError();
      // Reject before aborting so the deadline error wins the race.
      reject(error);
      controller.abort(error);
    }, timeoutMs);
  });
  try {
    return await Promise.race([run(controller.signal), deadline]);
  } finally {
    clearTimeout(timeoutId);
  }
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
  stage: DecisionReportAny["stage"];
  configuredRequired: number;
  effectiveRequired: number;
  attemptedAdapters: number;
  successfulOutputs: ModelOutput[];
  failedAdapters: number;
  failures?: DecisionFailure[];
  calibration?: TaskCalibrationReport;
  hierarchicalCalibration?: HierarchicalTaskCalibrationAnyDecision;
}): DecisionReportAny {
  return DecisionReportAnySchema.parse({
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
  /** Time limit for the parallel model stage. Default 120000. */
  timeoutMs?: number;
  /**
   * Separate time limit for the synthesis stage, so slow models cannot use
   * up synthesis time. Defaults to `timeoutMs`.
   */
  synthesisTimeoutMs?: number;
  /**
   * Once enough models have answered to meet the quorum, wait at most this
   * long for the rest, then stop them. Unset waits for every model until
   * `timeoutMs`.
   */
  quorumGraceMs?: number;
  /** Receives progress messages. Defaults to console.log. */
  logger?: RouterLogger;
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

export type QuorumRouterGuardedRouteOptions =
  & Omit<
    QuorumRouterRouteOptions,
    "hierarchicalCalibration"
  >
  & {
    hierarchicalCalibration: {
      observations: readonly unknown[];
      options?: TaskCalibrationOptions;
      query: HierarchicalTaskCalibrationQuery;
      driftGuard: HierarchicalCalibrationDriftGuardOptions;
    };
  };

type QuorumRouterAnyRouteOptions =
  | QuorumRouterRouteOptions
  | QuorumRouterGuardedRouteOptions;

export class QuorumRouter {
  private readonly modelAdapters: ModelAdapter[];
  private readonly synthesisAdapter: SynthesisAdapter;
  private readonly timeoutMs: number;
  private readonly synthesisTimeoutMs: number;
  private readonly quorumGraceMs?: number;
  private readonly logger: RouterLogger;
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
    this.timeoutMs = requireIntegerAtLeast(
      "timeoutMs",
      options.timeoutMs ?? 120_000,
      1,
    );
    this.synthesisTimeoutMs = requireIntegerAtLeast(
      "synthesisTimeoutMs",
      options.synthesisTimeoutMs ?? this.timeoutMs,
      1,
    );
    this.quorumGraceMs = options.quorumGraceMs === undefined
      ? undefined
      : requireIntegerAtLeast("quorumGraceMs", options.quorumGraceMs, 0);
    this.logger = options.logger ?? consoleRouterLogger;
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

  /**
   * Runs adapters in parallel under the execution time limit. Adapters still
   * running when the limit (or the quorum grace period) ends are recorded as
   * failures with code `router_timeout` or `quorum_grace_elapsed`, even if
   * they ignore the abort signal.
   */
  private async executeAdapters(
    prompt: string,
    adapters: ModelAdapter[],
    requiredSuccesses: number,
  ): Promise<PromiseSettledResult<ModelOutput>[]> {
    const controller = new AbortController();
    let rejectStopped!: (reason: unknown) => void;
    const stopped = new Promise<never>((_resolve, reject) => {
      rejectStopped = reject;
    });
    stopped.catch(() => {});
    let isStopped = false;
    const stop = (error: ProcessExecutionError) => {
      if (isStopped) {
        return;
      }
      isStopped = true;
      // Reject before aborting so stragglers report the router's reason.
      rejectStopped(error);
      controller.abort(error);
    };

    const timeoutId = setTimeout(
      () =>
        stop(
          new ProcessExecutionError(
            "router_timeout",
            `Model execution exceeded the ${this.timeoutMs}ms router timeout.`,
          ),
        ),
      this.timeoutMs,
    );
    let graceId: ReturnType<typeof setTimeout> | undefined;
    let successes = 0;
    const quorumGraceMs = this.quorumGraceMs;

    try {
      return await Promise.allSettled(
        adapters.map(async (adapter) => {
          const output = await Promise.race([
            (async () =>
              validateAdapterOutputIdentity(
                adapter,
                await adapter.invoke(prompt, controller.signal),
              ))(),
            stopped,
          ]);
          successes += 1;
          if (
            quorumGraceMs !== undefined && graceId === undefined &&
            successes >= requiredSuccesses && successes < adapters.length
          ) {
            graceId = setTimeout(
              () =>
                stop(
                  new ProcessExecutionError(
                    "quorum_grace_elapsed",
                    `Quorum was met; stopped waiting after the ${quorumGraceMs}ms grace period.`,
                  ),
                ),
              quorumGraceMs,
            );
          }
          return output;
        }),
      );
    } finally {
      clearTimeout(timeoutId);
      clearTimeout(graceId);
    }
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
    options: QuorumRouterAnyRouteOptions = {},
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
    options: QuorumRouterGuardedRouteOptions,
  ): Promise<DecisionReportEnvelopeWithGuardedCalibration>;
  async routeWithDecisionReport(
    prompt: string,
    options?: QuorumRouterRouteOptions,
  ): Promise<DecisionReportEnvelope>;
  async routeWithDecisionReport(
    prompt: string,
    options: QuorumRouterAnyRouteOptions = {},
  ): Promise<DecisionReportEnvelopeAny> {
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
    options: QuorumRouterAnyRouteOptions,
  ): Promise<DecisionReportEnvelopeAny> {
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
      | HierarchicalTaskCalibrationAnyDecision
      | undefined;
    if (options.hierarchicalCalibration) {
      try {
        const report = aggregateHierarchicalTaskCalibration(
          options.hierarchicalCalibration.observations,
          options.hierarchicalCalibration.options,
        );
        const driftGuard = "driftGuard" in options.hierarchicalCalibration
          ? options.hierarchicalCalibration.driftGuard
          : undefined;
        hierarchicalCalibration = driftGuard === undefined
          ? {
            report,
            selection: resolveHierarchicalTaskCalibration(
              report,
              options.hierarchicalCalibration.query,
            ),
          }
          : {
            report,
            selection: resolveHierarchicalTaskCalibrationWithDriftGuard(
              report,
              options.hierarchicalCalibration.query,
              driftGuard,
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

    this.logger.info("Starting parallel model execution...");
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

    const settled = await this.executeAdapters(
      prompt,
      executionAdapters,
      effectiveMinSuccessfulAdapters,
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

    this.logger.info(
      `Received ${successfulOutputs.length} validated responses. Synthesizing with ${this.synthesisAdapter.descriptor.provider}/${this.synthesisAdapter.descriptor.model}...`,
    );

    try {
      const final = FinalSynthesisSchema.parse(
        await runWithDeadline(
          (signal) =>
            this.synthesisAdapter.synthesize(
              prompt,
              successfulOutputs,
              signal,
            ),
          this.synthesisTimeoutMs,
          () =>
            new ProcessExecutionError(
              "router_timeout",
              `Synthesis exceeded the ${this.synthesisTimeoutMs}ms synthesis timeout.`,
            ),
        ),
      );
      const validatedSourceLabels = new Set(
        successfulOutputs.map((output) => `${output.provider}/${output.model}`),
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
      return DecisionReportEnvelopeAnySchema.parse({
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
            code: errorCode(error) === "router_timeout"
              ? "router_timeout"
              : "synthesis_failed",
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
  }
}

/** @deprecated Use QuorumRouterOptions. */
export type FusionRouterOptions = QuorumRouterOptions;
/** @deprecated Use QuorumRouterRouteOptions. */
export type FusionRouterRouteOptions = QuorumRouterRouteOptions;
/** @deprecated Use QuorumRouterGuardedRouteOptions. */
export type FusionRouterGuardedRouteOptions = QuorumRouterGuardedRouteOptions;
/** @deprecated Use QuorumRouter. */
export { QuorumRouter as FusionRouter };
