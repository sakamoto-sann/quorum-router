import { z } from "zod";
import {
  HierarchicalTaskCalibrationDecisionSchema,
  TaskCalibrationReportSchema,
} from "./calibration/calibration.ts";
import { ModelUsageSchema } from "./prompt-cache.ts";

export const AuthModeSchema = z.enum(["apiKey", "oauth", "session"]);
export const TransportSchema = z.enum([
  "zcodeWrapper",
  "processAdapter",
  "directHttp",
]);

export const ProviderDescriptorSchema = z.object({
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
  usage: ModelUsageSchema.optional(),
});

export type ModelOutput = z.infer<typeof ModelOutputSchema>;

export const FinalSynthesisSchema = z.object({
  synthesis: z.string().min(1),
  reasoning: z.string().min(1),
  consensusModel: z.string().min(1),
  sources: z.array(z.string().min(1)).min(1),
});

export const FinalSynthesisJsonSchema = {
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

export const DecisionOutcomeSchema = z.enum([
  "minimum_valid_outputs_synthesized",
  "no_executable_adapters",
  "insufficient_valid_outputs",
  "synthesis_failed",
]);

export const DecisionStageSchema = z.enum([
  "candidate_selection",
  "candidate_execution",
  "synthesis",
]);

export const DecisionQuorumSchema = z.object({
  configured_required: z.number().int().positive(),
  effective_required: z.number().int().nonnegative(),
  validated_outputs: z.number().int().nonnegative(),
}).superRefine((value, context) => {
  if (value.effective_required > value.configured_required) {
    context.addIssue({
      code: "custom",
      message: "effective_required cannot exceed configured_required",
    });
  }
});

export const DecisionExecutionSchema = z.object({
  attempted_adapters: z.number().int().nonnegative(),
  successful_adapters: z.number().int().nonnegative(),
  failed_adapters: z.number().int().nonnegative(),
}).superRefine((value, context) => {
  if (
    value.successful_adapters + value.failed_adapters !==
      value.attempted_adapters
  ) {
    context.addIssue({
      code: "custom",
      message:
        "successful_adapters + failed_adapters must equal attempted_adapters",
    });
  }
});

export const DecisionFailureSchema = z.object({
  stage: z.enum(["adapter_execution", "synthesis"]),
  provider: z.string().min(1),
  model: z.string().min(1),
  code: z.string().min(1),
});

export const DecisionReportSchema = z.object({
  schema_version: z.literal("quorum-router.decision-report.v1"),
  outcome: DecisionOutcomeSchema,
  stage: DecisionStageSchema,
  quorum: DecisionQuorumSchema,
  execution: DecisionExecutionSchema,
  validated_sources: z.array(z.string().min(1)),
  failures: z.array(DecisionFailureSchema),
  calibration: TaskCalibrationReportSchema.optional(),
  hierarchical_calibration: HierarchicalTaskCalibrationDecisionSchema
    .optional(),
}).superRefine((value, context) => {
  if (value.calibration && value.hierarchical_calibration) {
    context.addIssue({
      code: "custom",
      message:
        "flat and hierarchical calibration reports are mutually exclusive",
      path: ["hierarchical_calibration"],
    });
  }
  if (value.quorum.validated_outputs !== value.execution.successful_adapters) {
    context.addIssue({
      code: "custom",
      message: "validated_outputs must equal successful_adapters",
    });
  }
  if (value.validated_sources.length !== value.quorum.validated_outputs) {
    context.addIssue({
      code: "custom",
      message: "validated_sources must match validated_outputs",
    });
  }
  const adapterFailures = value.failures.filter((failure) =>
    failure.stage === "adapter_execution"
  ).length;
  if (adapterFailures !== value.execution.failed_adapters) {
    context.addIssue({
      code: "custom",
      message: "adapter execution failures must match failed_adapters",
    });
  }

  const minimumMet = value.quorum.effective_required > 0 &&
    value.quorum.validated_outputs >= value.quorum.effective_required;
  const synthesisFailures = value.failures.filter((failure) =>
    failure.stage === "synthesis"
  ).length;
  const validOutcome = (value.outcome === "minimum_valid_outputs_synthesized" &&
    value.stage === "synthesis" && minimumMet && synthesisFailures === 0) ||
    (value.outcome === "synthesis_failed" &&
      value.stage === "synthesis" && minimumMet && synthesisFailures >= 1) ||
    (value.outcome === "insufficient_valid_outputs" &&
      value.stage === "candidate_execution" &&
      value.quorum.effective_required > 0 && !minimumMet &&
      synthesisFailures === 0) ||
    (value.outcome === "no_executable_adapters" &&
      value.stage === "candidate_selection" &&
      value.quorum.effective_required === 0 &&
      value.execution.attempted_adapters === 0 &&
      value.quorum.validated_outputs === 0 && synthesisFailures === 0);
  if (!validOutcome) {
    context.addIssue({
      code: "custom",
      message:
        "outcome, stage, quorum, execution, and failures are inconsistent",
    });
  }
});

export type DecisionOutcome = z.infer<typeof DecisionOutcomeSchema>;
export type DecisionFailure = z.infer<typeof DecisionFailureSchema>;
export type DecisionReport = z.infer<typeof DecisionReportSchema>;

export const DecisionReportEnvelopeSchema = z.object({
  final: FinalSynthesisSchema,
  decision_report: DecisionReportSchema,
});

export type DecisionReportEnvelope = z.infer<
  typeof DecisionReportEnvelopeSchema
>;

export const TelemetryFailureSchema = z.object({
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
