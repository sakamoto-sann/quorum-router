import { z } from "zod";

export const MAX_ENSEMBLE_QUALITY_OBSERVATIONS = 10_000;
export const MAX_ENSEMBLE_PANEL_SIZE = 16;
export const MAX_OBSERVABLE_EMBEDDING_DIMENSION = 256;
export const MAX_ENSEMBLE_TOTAL_EVIDENCE_IDS = 1_000_000;
export const MAX_ENSEMBLE_TOTAL_EMBEDDING_VALUES = 1_000_000;
const MAX_IDENTIFIER_LENGTH = 128;

const canonicalIdentifier = z.string().min(1).max(MAX_IDENTIFIER_LENGTH).regex(
  /^[a-z0-9](?:[a-z0-9._:/-]{0,126}[a-z0-9])?$/,
  "must be a lowercase canonical ASCII identifier",
);
const boundedLabel = z.string().trim().min(1).max(256).refine(
  (value) => !/[\p{Cc}\p{Cf}\p{Default_Ignorable_Code_Point}]/u.test(value),
  "control and default-ignorable characters are not allowed",
);
const rfc3339 = z.string().datetime({ offset: true }).refine((value) => {
  if (value.endsWith("Z")) return true;
  const match = /[+-](\d{2}):(\d{2})$/.exec(value);
  return !!match && Number(match[1]) <= 23 && Number(match[2]) <= 59;
}, "must use a valid RFC 3339 UTC offset");

export const EnsembleQualitySourceSchema = z.object({
  provider: boundedLabel,
  model: boundedLabel,
}).strict();

const ObservableEmbeddingSchema = z.array(z.number().finite()).min(1).max(
  MAX_OBSERVABLE_EMBEDDING_DIMENSION,
).refine(
  (vector) => vector.some((component) => component !== 0),
  "observable reasoning embeddings must be non-zero",
);

export const EnsembleQualityCandidateSchema = z.object({
  source: EnsembleQualitySourceSchema,
  correct: z.boolean(),
  conclusion_id: canonicalIdentifier,
  evidence_ids: z.array(canonicalIdentifier).max(256),
  observable_reasoning_embedding: ObservableEmbeddingSchema.optional(),
  task_expertise_score: z.number().finite().min(0).max(1).optional(),
}).strict().superRefine((candidate, context) => {
  const ids = new Set<string>();
  for (const [index, id] of candidate.evidence_ids.entries()) {
    if (ids.has(id)) {
      context.addIssue({
        code: "custom",
        message: "evidence_ids must be unique",
        path: ["evidence_ids", index],
      });
    }
    ids.add(id);
  }
});

export const EnsembleQualityObservationSchema = z.object({
  observation_id: canonicalIdentifier,
  task_type: canonicalIdentifier,
  evaluation_basis: z.literal("caller_attested_external_ground_truth"),
  evaluated_at: rfc3339,
  candidates: z.array(EnsembleQualityCandidateSchema).min(2).max(
    MAX_ENSEMBLE_PANEL_SIZE,
  ),
  selected_source: EnsembleQualitySourceSchema.nullable(),
}).strict().superRefine((observation, context) => {
  const sourceKeys = new Set<string>();
  const dimensions = new Set<number>();
  for (const [index, candidate] of observation.candidates.entries()) {
    const key = sourceKey(candidate.source);
    if (sourceKeys.has(key)) {
      context.addIssue({
        code: "custom",
        message: "candidate sources must be unique",
        path: ["candidates", index, "source"],
      });
    }
    sourceKeys.add(key);
    if (candidate.observable_reasoning_embedding) {
      dimensions.add(candidate.observable_reasoning_embedding.length);
    }
  }
  if (dimensions.size > 1) {
    context.addIssue({
      code: "custom",
      message:
        "observable reasoning embedding dimensions must match within an observation",
      path: ["candidates"],
    });
  }
  if (
    observation.selected_source !== null &&
    !sourceKeys.has(sourceKey(observation.selected_source))
  ) {
    context.addIssue({
      code: "custom",
      message: "selected_source must belong to the panel",
      path: ["selected_source"],
    });
  }
});

export const EnsembleQualityObservationListSchema = z.array(
  EnsembleQualityObservationSchema,
).min(1).max(MAX_ENSEMBLE_QUALITY_OBSERVATIONS).superRefine(
  (observations, context) => {
    const ids = new Set<string>();
    const expectedPanel = panelKey(observations[0].candidates);
    const expectedTaskType = observations[0].task_type;
    let totalEvidenceIds = 0;
    let totalEmbeddingValues = 0;
    for (const [index, observation] of observations.entries()) {
      for (const candidate of observation.candidates) {
        totalEvidenceIds += candidate.evidence_ids.length;
        totalEmbeddingValues +=
          candidate.observable_reasoning_embedding?.length ?? 0;
      }
      if (ids.has(observation.observation_id)) {
        context.addIssue({
          code: "custom",
          message: "observation_id must be unique",
          path: [index, "observation_id"],
        });
      }
      ids.add(observation.observation_id);
      if (panelKey(observation.candidates) !== expectedPanel) {
        context.addIssue({
          code: "custom",
          message:
            "every observation must use the exact same provider/model panel",
          path: [index, "candidates"],
        });
      }
      if (observation.task_type !== expectedTaskType) {
        context.addIssue({
          code: "custom",
          message: "every observation must use the same task_type",
          path: [index, "task_type"],
        });
      }
    }
    if (totalEvidenceIds > MAX_ENSEMBLE_TOTAL_EVIDENCE_IDS) {
      context.addIssue({
        code: "custom",
        message: "aggregate evidence_ids exceed the bounded total",
      });
    }
    if (totalEmbeddingValues > MAX_ENSEMBLE_TOTAL_EMBEDDING_VALUES) {
      context.addIssue({
        code: "custom",
        message: "aggregate embedding values exceed the bounded total",
      });
    }
  },
);

export const EnsembleQualityOptionsSchema = z.object({}).strict();

const NullableRateSchema = z.number().finite().min(0).max(1).nullable();
const SourceAccuracySchema = z.object({
  source: EnsembleQualitySourceSchema,
  accuracy: z.number().finite().min(0).max(1),
  sample_count: z.number().int().positive(),
}).strict();
const PairwiseCofailureSchema = z.object({
  source_a: EnsembleQualitySourceSchema,
  source_b: EnsembleQualitySourceSchema,
  sample_count: z.number().int().positive(),
  pairwise_cofailure_count: z.number().int().nonnegative(),
  pairwise_cofailure: z.number().finite().min(0).max(1),
  outcome_disagreement_count: z.number().int().nonnegative(),
  outcome_disagreement_rate: z.number().finite().min(0).max(1),
  conditional_success_a_given_b_failed: NullableRateSchema,
  conditional_success_b_given_a_failed: NullableRateSchema,
}).strict().superRefine((pair, context) => {
  if (
    pair.pairwise_cofailure_count > pair.sample_count ||
    !approximatelyEqual(
      pair.pairwise_cofailure,
      pair.pairwise_cofailure_count / pair.sample_count,
    )
  ) {
    context.addIssue({
      code: "custom",
      message: "pairwise cofailure count and rate must agree",
    });
  }
  if (
    pair.outcome_disagreement_count > pair.sample_count ||
    !approximatelyEqual(
      pair.outcome_disagreement_rate,
      pair.outcome_disagreement_count / pair.sample_count,
    )
  ) {
    context.addIssue({
      code: "custom",
      message: "outcome disagreement count and rate must agree",
    });
  }
});
const AllModelCofailureBetaSchema = z.object({
  sample_count: z.number().int().positive(),
  all_failed_count: z.number().int().nonnegative(),
  observed_rate: z.number().finite().min(0).max(1),
}).strict().superRefine((beta, context) => {
  if (
    beta.all_failed_count > beta.sample_count ||
    !approximatelyEqual(
      beta.observed_rate,
      beta.all_failed_count / beta.sample_count,
    )
  ) {
    context.addIssue({
      code: "custom",
      message: "all-model cofailure count and observed rate must agree",
    });
  }
});
const CofailureMatrixSchema = z.object({
  panel_sources: z.array(EnsembleQualitySourceSchema).min(2).max(16),
  sources: z.array(SourceAccuracySchema).min(2).max(16),
  pairs: z.array(PairwiseCofailureSchema).min(1).max(120),
  all_model_cofailure_beta: AllModelCofailureBetaSchema,
}).strict();
const SelectionRegretSchema = z.object({
  observation_count: z.number().int().positive(),
  oracle_success_count: z.number().int().nonnegative(),
  selected_count: z.number().int().nonnegative(),
  selected_success_count: z.number().int().nonnegative(),
  oracle_success_rate: z.number().finite().min(0).max(1),
  selected_success_rate: z.number().finite().min(0).max(1),
  best_single_success_rate: z.number().finite().min(0).max(1),
  best_single_sources: z.array(EnsembleQualitySourceSchema).min(1).max(16),
  oracle_uplift: z.number().finite().min(0).max(1),
  captured_uplift: z.number().finite().min(-1).max(1),
  capture_rate: z.number().finite().max(1).nullable(),
  selection_success_given_oracle: NullableRateSchema,
  selection_regret: z.number().finite().min(0).max(1),
}).strict().superRefine((selection, context) => {
  const count = selection.observation_count;
  const oracleRate = selection.oracle_success_count / count;
  const selectedRate = selection.selected_success_count / count;
  const oracleUplift = oracleRate - selection.best_single_success_rate;
  const capturedUplift = selectedRate - selection.best_single_success_rate;
  const sourceKeys = selection.best_single_sources.map(sourceKey);
  const structurallyInvalid = selection.oracle_success_count > count ||
    selection.selected_count > count ||
    selection.selected_success_count > selection.selected_count ||
    selection.selected_success_count > selection.oracle_success_count ||
    new Set(sourceKeys).size !== sourceKeys.length ||
    !approximatelyEqual(selection.oracle_success_rate, oracleRate) ||
    !approximatelyEqual(selection.selected_success_rate, selectedRate) ||
    !approximatelyEqual(selection.oracle_uplift, oracleUplift) ||
    !approximatelyEqual(selection.captured_uplift, capturedUplift) ||
    !approximatelyEqual(
      selection.selection_regret,
      oracleRate - selectedRate,
    );
  const expectedConditional = selection.oracle_success_count === 0
    ? null
    : selection.selected_success_count / selection.oracle_success_count;
  const expectedCaptureRate = approximatelyEqual(oracleUplift, 0)
    ? null
    : capturedUplift / oracleUplift;
  if (
    structurallyInvalid ||
    !nullableMetricEqual(
      selection.selection_success_given_oracle,
      expectedConditional,
    ) ||
    !nullableMetricEqual(selection.capture_rate, expectedCaptureRate)
  ) {
    context.addIssue({
      code: "custom",
      message: "selection counts, rates, and regret must agree",
    });
  }
});
const AnswerSchema = z.object({
  conclusion_id: canonicalIdentifier,
  sources: z.array(EnsembleQualitySourceSchema).min(1).max(16),
}).strict();
const MinorityItemSchema = z.object({
  source: EnsembleQualitySourceSchema,
  conclusion_id: canonicalIdentifier,
  evidence_ids: z.array(canonicalIdentifier),
  externally_correct: z.boolean(),
}).strict();
const MinorityReportSchema = z.object({
  observation_id: canonicalIdentifier,
  majority_answer: AnswerSchema.nullable(),
  minority_reports: z.array(MinorityItemSchema).max(16),
  minority_supporting_evidence: z.array(canonicalIdentifier),
  majority_overturn_triggered: z.boolean(),
  unresolved_disagreement: z.array(canonicalIdentifier),
}).strict();
const ExpertiseSchema = z.object({
  source: EnsembleQualitySourceSchema,
  task_expertise_score: z.number().finite().min(0).max(1).nullable(),
}).strict();
const DiversitySchema = z.object({
  observation_id: canonicalIdentifier,
  normalized_conclusion_diversity: z.number().finite().min(0).max(1),
  mean_pairwise_evidence_jaccard_distance: z.number().finite().min(0).max(1),
  mean_pairwise_observable_reasoning_cosine_similarity: z.number().finite().min(
    -1,
  )
    .max(1).nullable(),
  observable_embedding_candidate_count: z.number().int().min(0).max(16),
  observable_reasoning_pair_count: z.number().int().min(0).max(120),
  effective_rank: z.number().finite().min(1).max(16).nullable(),
  observable_signature_count: z.number().int().min(1).max(16),
  effective_vote_count: z.number().finite().min(1).max(16),
  effective_vote_count_basis: z.enum([
    "embedding_effective_rank",
    "observable_signature_count",
  ]),
  task_expertise_by_source: z.array(ExpertiseSchema).min(2).max(16),
}).strict();

const EvaluationWindowSchema = z.object({
  started_at: rfc3339,
  ended_at: rfc3339,
}).strict();

export const EnsembleQualityReportSchema = z.object({
  schema_version: z.literal("quorum-router.ensemble-quality.v1"),
  advisory_only: z.literal(true),
  evaluation_basis: z.literal("caller_attested_external_ground_truth"),
  task_type: canonicalIdentifier,
  evaluation_window: EvaluationWindowSchema,
  observation_count: z.number().int().positive().max(
    MAX_ENSEMBLE_QUALITY_OBSERVATIONS,
  ),
  panel_sources: z.array(EnsembleQualitySourceSchema).min(2).max(16),
  cofailure_matrix: CofailureMatrixSchema,
  selection_regret: SelectionRegretSchema,
  minority_reports: z.array(MinorityReportSchema).min(1).max(
    MAX_ENSEMBLE_QUALITY_OBSERVATIONS,
  ),
  real_diversity_scores: z.array(DiversitySchema).min(1).max(
    MAX_ENSEMBLE_QUALITY_OBSERVATIONS,
  ),
}).strict().superRefine((report, context) => {
  if (
    JSON.stringify(report.panel_sources) !==
      JSON.stringify(report.cofailure_matrix.panel_sources)
  ) {
    context.addIssue({ code: "custom", message: "panel_sources must agree" });
  }
  if (
    report.observation_count !== report.selection_regret.observation_count ||
    report.observation_count !== report.minority_reports.length ||
    report.observation_count !== report.real_diversity_scores.length
  ) {
    context.addIssue({
      code: "custom",
      message: "report observation counts must agree",
    });
  }
  if (
    Date.parse(report.evaluation_window.started_at) >
      Date.parse(report.evaluation_window.ended_at)
  ) {
    context.addIssue({
      code: "custom",
      message: "evaluation_window must be chronological",
    });
  }
});

export type EnsembleQualitySource = z.infer<typeof EnsembleQualitySourceSchema>;
export type EnsembleQualityCandidate = z.infer<
  typeof EnsembleQualityCandidateSchema
>;
export type EnsembleQualityObservation = z.infer<
  typeof EnsembleQualityObservationSchema
>;
export type EnsembleQualityOptions = z.input<
  typeof EnsembleQualityOptionsSchema
>;
export type EnsembleQualityReport = z.infer<typeof EnsembleQualityReportSchema>;

function sourceKey(source: EnsembleQualitySource): string {
  return JSON.stringify([source.provider, source.model]);
}

function panelKey(candidates: readonly EnsembleQualityCandidate[]): string {
  return JSON.stringify(
    candidates.map((candidate) => sourceKey(candidate.source)).sort(),
  );
}

function compareSource(
  left: EnsembleQualitySource,
  right: EnsembleQualitySource,
): number {
  return compareCodeUnits(left.provider, right.provider) ||
    compareCodeUnits(left.model, right.model);
}

function compareCodeUnits(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function stableMetric(value: number): number {
  const rounded = Number(value.toPrecision(15));
  return rounded === 0 ? 0 : rounded;
}

function approximatelyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= 1e-12;
}

function nullableMetricEqual(
  left: number | null,
  right: number | null,
): boolean {
  return left === null || right === null
    ? left === right
    : approximatelyEqual(left, right);
}

function sortedCandidates(observation: EnsembleQualityObservation) {
  return [...observation.candidates].sort((left, right) =>
    compareSource(left.source, right.source)
  );
}

function cosine(left: readonly number[], right: readonly number[]): number {
  // Scale each vector before accumulating. The input schema rejects zero and
  // non-finite vectors, but finite components can still be large enough for a
  // naive square or dot product to overflow.
  const leftScale = Math.max(...left.map(Math.abs));
  const rightScale = Math.max(...right.map(Math.abs));
  let dot = 0;
  let leftSquared = 0;
  let rightSquared = 0;
  for (let index = 0; index < left.length; index++) {
    const leftComponent = left[index] / leftScale;
    const rightComponent = right[index] / rightScale;
    dot += leftComponent * rightComponent;
    leftSquared += leftComponent ** 2;
    rightSquared += rightComponent ** 2;
  }
  return Math.max(-1, Math.min(1, dot / Math.sqrt(leftSquared * rightSquared)));
}

/** Deterministic symmetric Jacobi eigensolver, bounded for panels of at most 16. */
function jacobiEigenvalues(input: readonly (readonly number[])[]): number[] {
  const matrix = input.map((row) => [...row]);
  const size = matrix.length;
  const maxSweeps = 64 * size * size;
  for (let sweep = 0; sweep < maxSweeps; sweep++) {
    let p = 0;
    let q = 1;
    let largest = 0;
    for (let row = 0; row < size; row++) {
      for (let column = row + 1; column < size; column++) {
        const magnitude = Math.abs(matrix[row][column]);
        if (magnitude > largest) {
          largest = magnitude;
          p = row;
          q = column;
        }
      }
    }
    if (largest <= 1e-12) break;
    const angle = 0.5 * Math.atan2(
      2 * matrix[p][q],
      matrix[q][q] - matrix[p][p],
    );
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const app = matrix[p][p];
    const aqq = matrix[q][q];
    const apq = matrix[p][q];
    matrix[p][p] = c * c * app - 2 * s * c * apq + s * s * aqq;
    matrix[q][q] = s * s * app + 2 * s * c * apq + c * c * aqq;
    matrix[p][q] = matrix[q][p] = 0;
    for (let index = 0; index < size; index++) {
      if (index === p || index === q) continue;
      const aip = matrix[index][p];
      const aiq = matrix[index][q];
      matrix[index][p] = matrix[p][index] = c * aip - s * aiq;
      matrix[index][q] = matrix[q][index] = s * aip + c * aiq;
    }
  }
  return matrix.map((row, index) => Math.max(0, row[index]));
}

function effectiveRank(vectors: readonly (readonly number[])[]): number {
  const gram = vectors.map((left) =>
    vectors.map((right) => cosine(left, right))
  );
  // The cited formula uses singular values of the embedding matrix. Gram
  // eigenvalues are squared singular values, so take their square roots.
  const singularValues = jacobiEigenvalues(gram)
    .filter((value) => value > 1e-12)
    .map(Math.sqrt);
  const total = singularValues.reduce((sum, value) => sum + value, 0);
  const entropy = singularValues.reduce((sum, value) => {
    const probability = value / total;
    return sum - probability * Math.log(probability);
  }, 0);
  return stableMetric(Math.exp(entropy));
}

function cofailure(
  observations: readonly EnsembleQualityObservation[],
  panelSources: readonly EnsembleQualitySource[],
) {
  const byObservation = observations.map((observation) =>
    new Map(
      observation.candidates.map((
        candidate,
      ) => [sourceKey(candidate.source), candidate]),
    )
  );
  const sampleCount = observations.length;
  const sources = panelSources.map((source) => {
    const correct = byObservation.reduce(
      (count, candidates) =>
        count + Number(candidates.get(sourceKey(source))!.correct),
      0,
    );
    return {
      source,
      accuracy: stableMetric(correct / sampleCount),
      sample_count: sampleCount,
    };
  });
  const pairs = [];
  for (let a = 0; a < panelSources.length; a++) {
    for (let b = a + 1; b < panelSources.length; b++) {
      const source_a = panelSources[a];
      const source_b = panelSources[b];
      let bothFailed = 0;
      let outcomesDisagreed = 0;
      let bFailed = 0;
      let aFailed = 0;
      let aSucceededWhenBFailed = 0;
      let bSucceededWhenAFailed = 0;
      for (const candidates of byObservation) {
        const aCorrect = candidates.get(sourceKey(source_a))!.correct;
        const bCorrect = candidates.get(sourceKey(source_b))!.correct;
        bothFailed += Number(!aCorrect && !bCorrect);
        outcomesDisagreed += Number(aCorrect !== bCorrect);
        bFailed += Number(!bCorrect);
        aFailed += Number(!aCorrect);
        aSucceededWhenBFailed += Number(aCorrect && !bCorrect);
        bSucceededWhenAFailed += Number(bCorrect && !aCorrect);
      }
      pairs.push({
        source_a,
        source_b,
        sample_count: sampleCount,
        pairwise_cofailure_count: bothFailed,
        pairwise_cofailure: stableMetric(bothFailed / sampleCount),
        outcome_disagreement_count: outcomesDisagreed,
        outcome_disagreement_rate: stableMetric(
          outcomesDisagreed / sampleCount,
        ),
        conditional_success_a_given_b_failed: bFailed === 0
          ? null
          : stableMetric(aSucceededWhenBFailed / bFailed),
        conditional_success_b_given_a_failed: aFailed === 0
          ? null
          : stableMetric(bSucceededWhenAFailed / aFailed),
      });
    }
  }
  const allFailed =
    observations.filter((observation) =>
      observation.candidates.every((candidate) => !candidate.correct)
    ).length;
  return {
    panel_sources: panelSources,
    sources,
    pairs,
    all_model_cofailure_beta: {
      sample_count: sampleCount,
      all_failed_count: allFailed,
      observed_rate: stableMetric(allFailed / sampleCount),
    },
  };
}

function selectionRegret(
  observations: readonly EnsembleQualityObservation[],
  panelSources: readonly EnsembleQualitySource[],
) {
  let oracleSuccessCount = 0;
  let selectedCount = 0;
  let selectedSuccessCount = 0;
  for (const observation of observations) {
    const oracle = observation.candidates.some((candidate) =>
      candidate.correct
    );
    oracleSuccessCount += Number(oracle);
    if (observation.selected_source) {
      selectedCount++;
      selectedSuccessCount += Number(
        observation.candidates.find((candidate) =>
          sourceKey(candidate.source) ===
            sourceKey(observation.selected_source!)
        )!.correct,
      );
    }
  }
  const count = observations.length;
  const oracleRate = stableMetric(oracleSuccessCount / count);
  const selectedRate = stableMetric(selectedSuccessCount / count);
  const sourceResults = panelSources.map((source) => ({
    source,
    successCount:
      observations.filter((observation) =>
        observation.candidates.find((candidate) =>
          sourceKey(candidate.source) === sourceKey(source)
        )!.correct
      ).length,
  }));
  const bestSingleSuccessCount = Math.max(
    ...sourceResults.map(({ successCount }) => successCount),
  );
  const bestSingleRate = bestSingleSuccessCount / count;
  const bestSingleSources = sourceResults
    .filter(({ successCount }) => successCount === bestSingleSuccessCount)
    .map(({ source }) => source);
  const oracleUplift = stableMetric(
    (oracleSuccessCount - bestSingleSuccessCount) / count,
  );
  const capturedUplift = stableMetric(
    (selectedSuccessCount - bestSingleSuccessCount) / count,
  );
  return {
    observation_count: count,
    oracle_success_count: oracleSuccessCount,
    selected_count: selectedCount,
    selected_success_count: selectedSuccessCount,
    oracle_success_rate: oracleRate,
    selected_success_rate: selectedRate,
    best_single_success_rate: stableMetric(bestSingleRate),
    best_single_sources: bestSingleSources,
    oracle_uplift: oracleUplift,
    captured_uplift: capturedUplift,
    capture_rate: oracleUplift === 0
      ? null
      : stableMetric(capturedUplift / oracleUplift),
    selection_success_given_oracle: oracleSuccessCount === 0
      ? null
      : stableMetric(selectedSuccessCount / oracleSuccessCount),
    selection_regret: stableMetric(oracleRate - selectedRate),
  };
}

function minorityReport(observation: EnsembleQualityObservation) {
  const candidates = sortedCandidates(observation);
  const groups = new Map<string, EnsembleQualityCandidate[]>();
  for (const candidate of candidates) {
    const group = groups.get(candidate.conclusion_id);
    if (group) group.push(candidate);
    else groups.set(candidate.conclusion_id, [candidate]);
  }
  const majority = [...groups.entries()].find(([, group]) =>
    group.length > candidates.length / 2
  );
  const minority = majority
    ? candidates.filter((candidate) => candidate.conclusion_id !== majority[0])
    : candidates;
  const conclusions = [...groups.keys()].sort();
  const selectedKey = observation.selected_source
    ? sourceKey(observation.selected_source)
    : null;
  return {
    observation_id: observation.observation_id,
    majority_answer: majority
      ? {
        conclusion_id: majority[0],
        sources: majority[1].map((candidate) => candidate.source),
      }
      : null,
    minority_reports: minority.map((candidate) => ({
      source: candidate.source,
      conclusion_id: candidate.conclusion_id,
      evidence_ids: [...candidate.evidence_ids].sort(),
      externally_correct: candidate.correct,
    })),
    minority_supporting_evidence: [
      ...new Set(minority.flatMap((candidate) => candidate.evidence_ids)),
    ].sort(),
    majority_overturn_triggered: !!majority && selectedKey !== null &&
      minority.some((candidate) => sourceKey(candidate.source) === selectedKey),
    unresolved_disagreement: conclusions.length > 1 ? conclusions : [],
  };
}

function diversity(observation: EnsembleQualityObservation) {
  const candidates = sortedCandidates(observation);
  const count = candidates.length;
  const conclusionCounts = new Map<string, number>();
  for (const candidate of candidates) {
    conclusionCounts.set(
      candidate.conclusion_id,
      (conclusionCounts.get(candidate.conclusion_id) ?? 0) + 1,
    );
  }
  const giniSimpson = 1 - [...conclusionCounts.values()].reduce(
    (sum, frequency) => sum + (frequency / count) ** 2,
    0,
  );
  const evidenceDistances: number[] = [];
  const cosineSimilarities: number[] = [];
  for (let left = 0; left < count; left++) {
    for (let right = left + 1; right < count; right++) {
      const a = new Set(candidates[left].evidence_ids);
      const b = new Set(candidates[right].evidence_ids);
      const union = new Set([...a, ...b]).size;
      const intersection = [...a].filter((id) => b.has(id)).length;
      evidenceDistances.push(union === 0 ? 0 : 1 - intersection / union);
      const leftVector = candidates[left].observable_reasoning_embedding;
      const rightVector = candidates[right].observable_reasoning_embedding;
      if (leftVector && rightVector) {
        cosineSimilarities.push(cosine(leftVector, rightVector));
      }
    }
  }
  const vectors = candidates.flatMap((candidate) =>
    candidate.observable_reasoning_embedding
      ? [candidate.observable_reasoning_embedding]
      : []
  );
  const rank = vectors.length < 2 ? null : effectiveRank(vectors);
  const signatures = new Set(candidates.map((candidate) =>
    JSON.stringify([
      candidate.conclusion_id,
      [...candidate.evidence_ids].sort(),
    ])
  )).size;
  return {
    observation_id: observation.observation_id,
    normalized_conclusion_diversity: stableMetric(
      giniSimpson / (1 - 1 / count),
    ),
    mean_pairwise_evidence_jaccard_distance: stableMetric(
      evidenceDistances.reduce((sum, value) => sum + value, 0) /
        evidenceDistances.length,
    ),
    mean_pairwise_observable_reasoning_cosine_similarity:
      cosineSimilarities.length < 1 ? null : stableMetric(
        cosineSimilarities.reduce((sum, value) => sum + value, 0) /
          cosineSimilarities.length,
      ),
    observable_embedding_candidate_count: vectors.length,
    observable_reasoning_pair_count: cosineSimilarities.length,
    effective_rank: rank,
    observable_signature_count: signatures,
    effective_vote_count: rank ?? signatures,
    effective_vote_count_basis: rank === null
      ? "observable_signature_count" as const
      : "embedding_effective_rank" as const,
    task_expertise_by_source: candidates.map((candidate) => ({
      source: candidate.source,
      task_expertise_score: candidate.task_expertise_score ?? null,
    })),
  };
}

/**
 * Aggregates externally evaluated observations without affecting any routing or
 * model-execution path. Input is parsed before any metric is computed.
 */
export function aggregateEnsembleQuality(
  observations: readonly unknown[],
  options: EnsembleQualityOptions = {},
): EnsembleQualityReport {
  EnsembleQualityOptionsSchema.parse(options);
  const parsed = EnsembleQualityObservationListSchema.parse(observations);
  const ordered = [...parsed].sort((left, right) =>
    compareCodeUnits(left.observation_id, right.observation_id)
  );
  const panelSources = sortedCandidates(ordered[0]).map((candidate) =>
    candidate.source
  );
  const evaluatedTimes = ordered.map((observation) =>
    Date.parse(observation.evaluated_at)
  );
  const evaluationWindow = {
    started_at: new Date(Math.min(...evaluatedTimes)).toISOString(),
    ended_at: new Date(Math.max(...evaluatedTimes)).toISOString(),
  };
  return EnsembleQualityReportSchema.parse({
    schema_version: "quorum-router.ensemble-quality.v1",
    advisory_only: true,
    evaluation_basis: "caller_attested_external_ground_truth",
    task_type: ordered[0].task_type,
    evaluation_window: evaluationWindow,
    observation_count: ordered.length,
    panel_sources: panelSources,
    cofailure_matrix: cofailure(ordered, panelSources),
    selection_regret: selectionRegret(ordered, panelSources),
    minority_reports: ordered.map(minorityReport),
    real_diversity_scores: ordered.map(diversity),
  });
}
