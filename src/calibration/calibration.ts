import { z } from "zod";

export const MAX_CALIBRATION_OBSERVATIONS = 10_000;
export const MAX_CALIBRATION_IDENTIFIER_LENGTH = 256;

function stableMetric(value: number): number {
  const rounded = Number(value.toPrecision(15));
  return rounded === 0 ? 0 : rounded;
}

function boundedCanonicalText(maxLength: number) {
  return z.string().trim().transform((value) => value.normalize("NFC")).pipe(
    z.string().min(1).max(maxLength).refine(
      (value) => !/[\p{Cc}\p{Cf}\p{Default_Ignorable_Code_Point}]/u.test(value),
      "control and default-ignorable characters are not allowed",
    ),
  );
}

function hasValidRfc3339Offset(value: string): boolean {
  if (value.endsWith("Z")) return true;
  const match = /[+-](\d{2}):(\d{2})$/.exec(value);
  if (!match) return false;
  return Number(match[1]) <= 23 && Number(match[2]) <= 59;
}

const ObservationIdSchema = boundedCanonicalText(
  MAX_CALIBRATION_IDENTIFIER_LENGTH,
);
const TaskTypeSchema = boundedCanonicalText(MAX_CALIBRATION_IDENTIFIER_LENGTH);
const SourceLabelSchema = boundedCanonicalText(
  MAX_CALIBRATION_IDENTIFIER_LENGTH,
);
const EvaluationTimestampSchema = z.string().datetime({ offset: true }).refine(
  hasValidRfc3339Offset,
  "evaluated_at must use a valid RFC 3339 UTC offset",
);

export const TaskCalibrationSourceSchema = z.object({
  provider: SourceLabelSchema,
  model: SourceLabelSchema,
}).strict();

/**
 * Structurally validated calibration input supplied by the caller.
 *
 * `evaluation_basis` records an unverified provenance assertion; this schema
 * cannot establish label independence, label quality, example matching, or
 * freedom from leakage. `confidence` must be the model's probability, recorded
 * before the correctness label is observed, that this specific answer is
 * correct. The schema can enforce only the numeric range, not that provenance.
 */
export const TaskCalibrationObservationSchema = z.object({
  observation_id: ObservationIdSchema,
  task_type: TaskTypeSchema,
  source: TaskCalibrationSourceSchema,
  evaluation_basis: z.literal("caller_attested_external_ground_truth"),
  correct: z.boolean(),
  confidence: z.number().finite().min(0).max(1),
  evaluated_at: EvaluationTimestampSchema,
}).strict();

export const TaskCalibrationObservationListSchema = z.array(
  TaskCalibrationObservationSchema,
).max(MAX_CALIBRATION_OBSERVATIONS).superRefine((observations, context) => {
  const ids = new Set<string>();
  for (const [index, observation] of observations.entries()) {
    if (ids.has(observation.observation_id)) {
      context.addIssue({
        code: "custom",
        message: "observation_id must be unique",
        path: [index, "observation_id"],
      });
    }
    ids.add(observation.observation_id);
  }
});

export const TaskCalibrationOptionsSchema = z.object({
  minimum_sample_count: z.number().finite().int().positive().max(
    MAX_CALIBRATION_OBSERVATIONS,
  ).default(20),
}).strict();

export const TaskCalibrationGroupSchema = z.object({
  task_type: TaskTypeSchema,
  source: TaskCalibrationSourceSchema,
  sample_count: z.number().int().positive().max(MAX_CALIBRATION_OBSERVATIONS),
  accuracy: z.number().finite().min(0).max(1),
  mean_confidence: z.number().finite().min(0).max(1),
  brier_score: z.number().finite().min(0).max(1),
  mean_calibration_bias: z.number().finite().min(-1).max(1),
  // "sufficient" means only that the configured sample-count threshold is met.
  sample_status: z.enum(["insufficient", "sufficient"]),
}).strict();

export const TaskCalibrationReportSchema = z.object({
  schema_version: z.literal("quorum-router.calibration-by-task.v1"),
  advisory_only: z.literal(true),
  minimum_sample_count: z.number().int().positive().max(
    MAX_CALIBRATION_OBSERVATIONS,
  ),
  groups: z.array(TaskCalibrationGroupSchema).max(MAX_CALIBRATION_OBSERVATIONS),
}).strict().superRefine((report, context) => {
  const groupKeys = new Set<string>();
  for (const [index, group] of report.groups.entries()) {
    const groupKey = JSON.stringify([
      group.task_type,
      group.source.provider,
      group.source.model,
    ]);
    if (groupKeys.has(groupKey)) {
      context.addIssue({
        code: "custom",
        message: "calibration report groups must be unique",
        path: ["groups", index],
      });
    }
    groupKeys.add(groupKey);

    const expectedStatus = group.sample_count < report.minimum_sample_count
      ? "insufficient"
      : "sufficient";
    if (group.sample_status !== expectedStatus) {
      context.addIssue({
        code: "custom",
        message: "sample_status must match the configured sample threshold",
        path: ["groups", index, "sample_status"],
      });
    }

    const expectedBias = stableMetric(
      group.mean_confidence - group.accuracy,
    );
    if (group.mean_calibration_bias !== expectedBias) {
      context.addIssue({
        code: "custom",
        message: "mean_calibration_bias must equal mean_confidence - accuracy",
        path: ["groups", index, "mean_calibration_bias"],
      });
    }
  }
});

export type TaskCalibrationSource = z.infer<
  typeof TaskCalibrationSourceSchema
>;
export type TaskCalibrationObservation = z.infer<
  typeof TaskCalibrationObservationSchema
>;
export type TaskCalibrationOptions = z.input<
  typeof TaskCalibrationOptionsSchema
>;
export type TaskCalibrationGroup = z.infer<
  typeof TaskCalibrationGroupSchema
>;
export type TaskCalibrationReport = z.infer<
  typeof TaskCalibrationReportSchema
>;

function stableSum(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  let total = 0;
  let compensation = 0;

  for (const value of sorted) {
    const next = total + value;
    compensation += Math.abs(total) >= Math.abs(value)
      ? (total - next) + value
      : (value - next) + total;
    total = next;
  }

  return total + compensation;
}

function compareCodeUnits(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export function aggregateTaskCalibration(
  observations: readonly unknown[],
  options: TaskCalibrationOptions = {},
): TaskCalibrationReport {
  const parsedObservations = TaskCalibrationObservationListSchema.parse(
    observations,
  );
  const { minimum_sample_count } = TaskCalibrationOptionsSchema.parse(options);
  const grouped = new Map<string, TaskCalibrationObservation[]>();

  for (const observation of parsedObservations) {
    const key = JSON.stringify([
      observation.task_type,
      observation.source.provider,
      observation.source.model,
    ]);
    const group = grouped.get(key);
    if (group) {
      group.push(observation);
    } else {
      grouped.set(key, [observation]);
    }
  }

  const groups = [...grouped.values()].map((group) => {
    const sample_count = group.length;
    const correctCount = group.reduce(
      (total, observation) => total + Number(observation.correct),
      0,
    );
    const confidenceTotal = stableSum(
      group.map((observation) => observation.confidence),
    );
    const brierTotal = stableSum(
      group.map((observation) => {
        const outcome = Number(observation.correct);
        return (observation.confidence - outcome) ** 2;
      }),
    );
    const accuracy = stableMetric(correctCount / sample_count);
    const mean_confidence = stableMetric(confidenceTotal / sample_count);

    return {
      task_type: group[0].task_type,
      source: group[0].source,
      sample_count,
      accuracy,
      mean_confidence,
      brier_score: stableMetric(brierTotal / sample_count),
      mean_calibration_bias: stableMetric(mean_confidence - accuracy),
      sample_status: sample_count < minimum_sample_count
        ? "insufficient" as const
        : "sufficient" as const,
    };
  }).sort((left, right) =>
    compareCodeUnits(left.task_type, right.task_type) ||
    compareCodeUnits(left.source.provider, right.source.provider) ||
    compareCodeUnits(left.source.model, right.source.model)
  );

  return TaskCalibrationReportSchema.parse({
    schema_version: "quorum-router.calibration-by-task.v1",
    advisory_only: true,
    minimum_sample_count,
    groups,
  });
}
