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
const HierarchicalTaxonomyLabelSchema = boundedCanonicalText(128).refine(
  (value) => /^[a-z0-9](?:[a-z0-9._:/-]{0,126}[a-z0-9])?$/.test(value),
  "hierarchical taxonomy labels must be lowercase canonical ASCII identifiers",
);
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

export const MAX_HIERARCHICAL_CALIBRATION_GROUPS =
  MAX_CALIBRATION_OBSERVATIONS * 3;

export const HierarchicalCalibrationScopeSchema = z.enum([
  "task_type",
  "task_subtype",
  "prompt_pattern",
]);

export const HierarchicalTaskCalibrationObservationSchema = z.object({
  observation_id: ObservationIdSchema,
  task_type: TaskTypeSchema,
  task_subtype: HierarchicalTaxonomyLabelSchema.optional(),
  prompt_pattern: HierarchicalTaxonomyLabelSchema.optional(),
  source: TaskCalibrationSourceSchema,
  evaluation_basis: z.literal("caller_attested_external_ground_truth"),
  correct: z.boolean(),
  confidence: z.number().finite().min(0).max(1),
  evaluated_at: EvaluationTimestampSchema,
}).strict().superRefine((observation, context) => {
  if (
    observation.prompt_pattern !== undefined &&
    observation.task_subtype === undefined
  ) {
    context.addIssue({
      code: "custom",
      message: "prompt_pattern requires task_subtype",
      path: ["prompt_pattern"],
    });
  }
});

export const HierarchicalTaskCalibrationObservationListSchema = z.array(
  HierarchicalTaskCalibrationObservationSchema,
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

export const HierarchicalTaskCalibrationGroupSchema = z.object({
  scope: HierarchicalCalibrationScopeSchema,
  task_type: TaskTypeSchema,
  task_subtype: HierarchicalTaxonomyLabelSchema.optional(),
  prompt_pattern: HierarchicalTaxonomyLabelSchema.optional(),
  source: TaskCalibrationSourceSchema,
  sample_count: z.number().int().positive().max(MAX_CALIBRATION_OBSERVATIONS),
  accuracy: z.number().finite().min(0).max(1),
  mean_confidence: z.number().finite().min(0).max(1),
  brier_score: z.number().finite().min(0).max(1),
  mean_calibration_bias: z.number().finite().min(-1).max(1),
  sample_status: z.enum(["insufficient", "sufficient"]),
}).strict().superRefine((group, context) => {
  const validLabels =
    (group.scope === "task_type" && group.task_subtype === undefined &&
      group.prompt_pattern === undefined) ||
    (group.scope === "task_subtype" && group.task_subtype !== undefined &&
      group.prompt_pattern === undefined) ||
    (group.scope === "prompt_pattern" && group.task_subtype !== undefined &&
      group.prompt_pattern !== undefined);
  if (!validLabels) {
    context.addIssue({
      code: "custom",
      message: "scope must match task_subtype and prompt_pattern labels",
    });
  }
});

export const HierarchicalTaskCalibrationReportSchema = z.object({
  schema_version: z.literal("quorum-router.hierarchical-calibration.v1"),
  advisory_only: z.literal(true),
  minimum_sample_count: z.number().int().positive().max(
    MAX_CALIBRATION_OBSERVATIONS,
  ),
  groups: z.array(HierarchicalTaskCalibrationGroupSchema).max(
    MAX_HIERARCHICAL_CALIBRATION_GROUPS,
  ),
}).strict().superRefine((report, context) => {
  const groupKeys = new Set<string>();
  for (const [index, group] of report.groups.entries()) {
    const groupKey = JSON.stringify([
      group.scope,
      group.task_type,
      group.task_subtype ?? null,
      group.prompt_pattern ?? null,
      group.source.provider,
      group.source.model,
    ]);
    if (groupKeys.has(groupKey)) {
      context.addIssue({
        code: "custom",
        message: "hierarchical calibration report groups must be unique",
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
    if (
      group.mean_calibration_bias !==
        stableMetric(group.mean_confidence - group.accuracy)
    ) {
      context.addIssue({
        code: "custom",
        message: "mean_calibration_bias must equal mean_confidence - accuracy",
        path: ["groups", index, "mean_calibration_bias"],
      });
    }
  }
});

export const HierarchicalTaskCalibrationQuerySchema = z.object({
  task_type: TaskTypeSchema,
  task_subtype: HierarchicalTaxonomyLabelSchema.optional(),
  prompt_pattern: HierarchicalTaxonomyLabelSchema.optional(),
  source: TaskCalibrationSourceSchema,
}).strict().superRefine((query, context) => {
  if (query.prompt_pattern !== undefined && query.task_subtype === undefined) {
    context.addIssue({
      code: "custom",
      message: "prompt_pattern requires task_subtype",
      path: ["prompt_pattern"],
    });
  }
});

const HierarchicalCalibrationCandidateSchema = z.object({
  scope: HierarchicalCalibrationScopeSchema,
  sample_count: z.number().int().positive().max(MAX_CALIBRATION_OBSERVATIONS)
    .nullable(),
  sample_status: z.enum(["missing", "insufficient", "sufficient"]),
}).strict().superRefine((candidate, context) => {
  if (
    (candidate.sample_status === "missing") !==
      (candidate.sample_count === null)
  ) {
    context.addIssue({
      code: "custom",
      message: "missing candidates must have a null sample_count",
    });
  }
});

export const HierarchicalTaskCalibrationSelectionSchema = z.object({
  schema_version: z.literal("quorum-router.hierarchical-selection.v1"),
  advisory_only: z.literal(true),
  query: HierarchicalTaskCalibrationQuerySchema,
  requested_scope: HierarchicalCalibrationScopeSchema,
  resolution_status: z.enum(["selected", "no_sufficient_group"]),
  selected_scope: HierarchicalCalibrationScopeSchema.nullable(),
  candidates: z.array(HierarchicalCalibrationCandidateSchema).min(1).max(3),
  selected_group: HierarchicalTaskCalibrationGroupSchema.optional(),
}).strict().superRefine((selection, context) => {
  const queryScope = selection.query.prompt_pattern !== undefined
    ? "prompt_pattern"
    : selection.query.task_subtype !== undefined
    ? "task_subtype"
    : "task_type";
  if (selection.requested_scope !== queryScope) {
    context.addIssue({
      code: "custom",
      message: "requested_scope must match the query labels",
      path: ["requested_scope"],
    });
  }

  const expectedScopes = selection.requested_scope === "prompt_pattern"
    ? ["prompt_pattern", "task_subtype", "task_type"]
    : selection.requested_scope === "task_subtype"
    ? ["task_subtype", "task_type"]
    : ["task_type"];
  if (
    JSON.stringify(selection.candidates.map((candidate) => candidate.scope)) !==
      JSON.stringify(expectedScopes)
  ) {
    context.addIssue({
      code: "custom",
      message: "candidates must follow the requested scope fallback order",
      path: ["candidates"],
    });
  }

  const firstSufficient = selection.candidates.find((candidate) =>
    candidate.sample_status === "sufficient"
  );
  if (firstSufficient === undefined) {
    if (
      selection.resolution_status !== "no_sufficient_group" ||
      selection.selected_scope !== null ||
      selection.selected_group !== undefined
    ) {
      context.addIssue({
        code: "custom",
        message: "no sufficient candidate must produce no selection",
      });
    }
  } else if (
    selection.resolution_status !== "selected" ||
    selection.selected_scope !== firstSufficient.scope ||
    selection.selected_group?.scope !== firstSufficient.scope ||
    selection.selected_group.sample_count !== firstSufficient.sample_count
  ) {
    context.addIssue({
      code: "custom",
      message: "selection must use the first sufficient candidate",
    });
  }
});

export const HierarchicalTaskCalibrationDecisionSchema = z.object({
  report: HierarchicalTaskCalibrationReportSchema,
  selection: HierarchicalTaskCalibrationSelectionSchema,
}).strict().superRefine((decision, context) => {
  const { query } = decision.selection;
  const expectedGroups = decision.selection.candidates.map((candidate) =>
    decision.report.groups.find((group) =>
      group.scope === candidate.scope && group.task_type === query.task_type &&
      group.source.provider === query.source.provider &&
      group.source.model === query.source.model &&
      (candidate.scope === "task_type" ||
        group.task_subtype === query.task_subtype) &&
      (candidate.scope !== "prompt_pattern" ||
        group.prompt_pattern === query.prompt_pattern)
    )
  );

  decision.selection.candidates.forEach((candidate, index) => {
    const group = expectedGroups[index];
    const expected = group === undefined
      ? { sample_count: null, sample_status: "missing" }
      : {
        sample_count: group.sample_count,
        sample_status: group.sample_status,
      };
    if (
      candidate.sample_count !== expected.sample_count ||
      candidate.sample_status !== expected.sample_status
    ) {
      context.addIssue({
        code: "custom",
        message: "selection candidate must match the aggregate report",
        path: ["selection", "candidates", index],
      });
    }
  });

  const expectedSelected = expectedGroups.find((group) =>
    group?.sample_status === "sufficient"
  );
  if (
    JSON.stringify(decision.selection.selected_group) !==
      JSON.stringify(expectedSelected)
  ) {
    context.addIssue({
      code: "custom",
      message: "selected_group must match the first sufficient report group",
      path: ["selection", "selected_group"],
    });
  }
});

export type HierarchicalCalibrationScope = z.infer<
  typeof HierarchicalCalibrationScopeSchema
>;
export type HierarchicalTaskCalibrationObservation = z.infer<
  typeof HierarchicalTaskCalibrationObservationSchema
>;
export type HierarchicalTaskCalibrationGroup = z.infer<
  typeof HierarchicalTaskCalibrationGroupSchema
>;
export type HierarchicalTaskCalibrationReport = z.infer<
  typeof HierarchicalTaskCalibrationReportSchema
>;
export type HierarchicalTaskCalibrationQuery = z.infer<
  typeof HierarchicalTaskCalibrationQuerySchema
>;
export type HierarchicalTaskCalibrationSelection = z.infer<
  typeof HierarchicalTaskCalibrationSelectionSchema
>;
export type HierarchicalTaskCalibrationDecision = z.infer<
  typeof HierarchicalTaskCalibrationDecisionSchema
>;

type HierarchicalGroupSeed = {
  scope: HierarchicalCalibrationScope;
  task_type: string;
  task_subtype?: string;
  prompt_pattern?: string;
  source: TaskCalibrationSource;
  observations: HierarchicalTaskCalibrationObservation[];
};

function summarizeHierarchicalGroup(
  seed: HierarchicalGroupSeed,
  minimumSampleCount: number,
): HierarchicalTaskCalibrationGroup {
  const sample_count = seed.observations.length;
  const correctCount = seed.observations.reduce(
    (total, observation) => total + Number(observation.correct),
    0,
  );
  const confidenceTotal = stableSum(
    seed.observations.map((observation) => observation.confidence),
  );
  const brierTotal = stableSum(seed.observations.map((observation) => {
    const outcome = Number(observation.correct);
    return (observation.confidence - outcome) ** 2;
  }));
  const accuracy = stableMetric(correctCount / sample_count);
  const mean_confidence = stableMetric(confidenceTotal / sample_count);

  return HierarchicalTaskCalibrationGroupSchema.parse({
    scope: seed.scope,
    task_type: seed.task_type,
    ...(seed.task_subtype === undefined
      ? {}
      : { task_subtype: seed.task_subtype }),
    ...(seed.prompt_pattern === undefined
      ? {}
      : { prompt_pattern: seed.prompt_pattern }),
    source: seed.source,
    sample_count,
    accuracy,
    mean_confidence,
    brier_score: stableMetric(brierTotal / sample_count),
    mean_calibration_bias: stableMetric(mean_confidence - accuracy),
    sample_status: sample_count < minimumSampleCount
      ? "insufficient"
      : "sufficient",
  });
}

export function aggregateHierarchicalTaskCalibration(
  observations: readonly unknown[],
  options: TaskCalibrationOptions = {},
): HierarchicalTaskCalibrationReport {
  const parsed = HierarchicalTaskCalibrationObservationListSchema.parse(
    observations,
  );
  const { minimum_sample_count } = TaskCalibrationOptionsSchema.parse(options);
  const grouped = new Map<string, HierarchicalGroupSeed>();

  function add(
    observation: HierarchicalTaskCalibrationObservation,
    scope: HierarchicalCalibrationScope,
  ) {
    const task_subtype = scope === "task_type"
      ? undefined
      : observation.task_subtype;
    const prompt_pattern = scope === "prompt_pattern"
      ? observation.prompt_pattern
      : undefined;
    const key = JSON.stringify([
      scope,
      observation.task_type,
      task_subtype ?? null,
      prompt_pattern ?? null,
      observation.source.provider,
      observation.source.model,
    ]);
    const existing = grouped.get(key);
    if (existing) {
      existing.observations.push(observation);
      return;
    }
    grouped.set(key, {
      scope,
      task_type: observation.task_type,
      ...(task_subtype === undefined ? {} : { task_subtype }),
      ...(prompt_pattern === undefined ? {} : { prompt_pattern }),
      source: observation.source,
      observations: [observation],
    });
  }

  for (const observation of parsed) {
    add(observation, "task_type");
    if (observation.task_subtype !== undefined) {
      add(observation, "task_subtype");
    }
    if (observation.prompt_pattern !== undefined) {
      add(observation, "prompt_pattern");
    }
  }

  const scopeOrder: Record<HierarchicalCalibrationScope, number> = {
    task_type: 0,
    task_subtype: 1,
    prompt_pattern: 2,
  };
  const groups = [...grouped.values()].map((seed) =>
    summarizeHierarchicalGroup(seed, minimum_sample_count)
  ).sort((left, right) =>
    compareCodeUnits(left.task_type, right.task_type) ||
    compareCodeUnits(left.source.provider, right.source.provider) ||
    compareCodeUnits(left.source.model, right.source.model) ||
    scopeOrder[left.scope] - scopeOrder[right.scope] ||
    compareCodeUnits(left.task_subtype ?? "", right.task_subtype ?? "") ||
    compareCodeUnits(left.prompt_pattern ?? "", right.prompt_pattern ?? "")
  );

  return HierarchicalTaskCalibrationReportSchema.parse({
    schema_version: "quorum-router.hierarchical-calibration.v1",
    advisory_only: true,
    minimum_sample_count,
    groups,
  });
}

export function resolveHierarchicalTaskCalibration(
  report: HierarchicalTaskCalibrationReport,
  query: HierarchicalTaskCalibrationQuery,
): HierarchicalTaskCalibrationSelection {
  const parsedReport = HierarchicalTaskCalibrationReportSchema.parse(report);
  const parsedQuery = HierarchicalTaskCalibrationQuerySchema.parse(query);
  const requested_scope: HierarchicalCalibrationScope =
    parsedQuery.prompt_pattern !== undefined
      ? "prompt_pattern"
      : parsedQuery.task_subtype !== undefined
      ? "task_subtype"
      : "task_type";
  const scopes: HierarchicalCalibrationScope[] = requested_scope ===
      "prompt_pattern"
    ? ["prompt_pattern", "task_subtype", "task_type"]
    : requested_scope === "task_subtype"
    ? ["task_subtype", "task_type"]
    : ["task_type"];

  const matchingGroups = scopes.map((scope) =>
    parsedReport.groups.find((group) =>
      group.scope === scope && group.task_type === parsedQuery.task_type &&
      group.source.provider === parsedQuery.source.provider &&
      group.source.model === parsedQuery.source.model &&
      (scope === "task_type" ||
        group.task_subtype === parsedQuery.task_subtype) &&
      (scope !== "prompt_pattern" ||
        group.prompt_pattern === parsedQuery.prompt_pattern)
    )
  );
  const candidates = scopes.map((scope, index) => {
    const group = matchingGroups[index];
    return group === undefined
      ? { scope, sample_count: null, sample_status: "missing" as const }
      : {
        scope,
        sample_count: group.sample_count,
        sample_status: group.sample_status,
      };
  });
  const selected_group = matchingGroups.find((group) =>
    group?.sample_status === "sufficient"
  );

  return HierarchicalTaskCalibrationSelectionSchema.parse({
    schema_version: "quorum-router.hierarchical-selection.v1",
    advisory_only: true,
    query: parsedQuery,
    requested_scope,
    resolution_status: selected_group === undefined
      ? "no_sufficient_group"
      : "selected",
    selected_scope: selected_group?.scope ?? null,
    candidates,
    ...(selected_group === undefined ? {} : { selected_group }),
  });
}
