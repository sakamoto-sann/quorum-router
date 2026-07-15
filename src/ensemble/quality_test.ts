import {
  assert,
  assertAlmostEquals,
  assertEquals,
  assertThrows,
} from "@std/assert";
import {
  aggregateEnsembleQuality,
  EnsembleQualityObservationSchema,
  EnsembleQualityReportSchema,
  MAX_ENSEMBLE_QUALITY_OBSERVATIONS,
} from "../../router.ts";

const A = { provider: "alpha", model: "a-1" };
const B = { provider: "beta", model: "b-1" };
const C = { provider: "gamma", model: "c-1" };

function candidate(
  source: typeof A,
  conclusion_id: string,
  correct: boolean,
  evidence_ids: string[],
  observable_reasoning_embedding?: number[],
  task_expertise_score?: number,
) {
  return {
    source,
    conclusion_id,
    correct,
    evidence_ids,
    ...(observable_reasoning_embedding
      ? { observable_reasoning_embedding }
      : {}),
    ...(task_expertise_score === undefined ? {} : { task_expertise_score }),
  };
}

function observation(
  observation_id: string,
  candidates: ReturnType<typeof candidate>[],
  selected_source: typeof A | null = A,
) {
  return {
    observation_id,
    task_type: "code_review",
    evaluation_basis: "caller_attested_external_ground_truth" as const,
    evaluated_at: "2026-07-14T00:00:00Z",
    candidates,
    selected_source,
  };
}

function fixture() {
  return [
    observation("obs-1", [
      candidate(A, "answer_a", true, ["e1"], [1, 0], 0.9),
      candidate(B, "answer_a", true, ["e1", "e2"], [1, 0]),
      candidate(C, "answer_c", false, ["e3"], [1, 0], 0.4),
    ], C),
    observation("obs-2", [
      candidate(A, "answer_a", false, ["e4"]),
      candidate(B, "answer_b", true, ["e5"]),
      candidate(C, "answer_c", false, ["e6"]),
    ], B),
    observation("obs-3", [
      candidate(A, "answer_a", false, ["e7"]),
      candidate(B, "answer_b", false, ["e8"]),
      candidate(C, "answer_c", false, ["e9"]),
    ], null),
    observation("obs-4", [
      candidate(A, "answer_a", true, ["e10"]),
      candidate(B, "answer_b", false, ["e11"]),
      candidate(C, "answer_c", true, ["e12"]),
    ], A),
  ];
}

Deno.test("ensemble quality computes exact cofailure and selection metrics", () => {
  const report = aggregateEnsembleQuality(fixture());
  assertEquals(report.advisory_only, true);
  assertEquals(
    report.evaluation_basis,
    "caller_attested_external_ground_truth",
  );
  assertEquals(report.task_type, "code_review");
  assertEquals(report.evaluation_window, {
    started_at: "2026-07-14T00:00:00.000Z",
    ended_at: "2026-07-14T00:00:00.000Z",
  });
  assertEquals(report.panel_sources, [A, B, C]);
  assertEquals(report.cofailure_matrix.sources, [
    { source: A, accuracy: 0.5, sample_count: 4 },
    { source: B, accuracy: 0.5, sample_count: 4 },
    { source: C, accuracy: 0.25, sample_count: 4 },
  ]);
  assertEquals(report.cofailure_matrix.pairs[0], {
    source_a: A,
    source_b: B,
    sample_count: 4,
    pairwise_cofailure_count: 1,
    pairwise_cofailure: 0.25,
    outcome_disagreement_count: 2,
    outcome_disagreement_rate: 0.5,
    conditional_success_a_given_b_failed: 0.5,
    conditional_success_b_given_a_failed: 0.5,
  });
  assertEquals(report.cofailure_matrix.pairs[1].pairwise_cofailure, 0.5);
  assertEquals(report.cofailure_matrix.pairs[2].pairwise_cofailure, 0.25);
  assertEquals(report.cofailure_matrix.all_model_cofailure_beta, {
    sample_count: 4,
    all_failed_count: 1,
    observed_rate: 0.25,
  });
  assertEquals(report.selection_regret, {
    observation_count: 4,
    oracle_success_count: 3,
    selected_count: 3,
    selected_success_count: 2,
    oracle_success_rate: 0.75,
    selected_success_rate: 0.5,
    best_single_success_rate: 0.5,
    best_single_sources: [A, B],
    oracle_uplift: 0.25,
    captured_uplift: 0,
    capture_rate: 0,
    selection_success_given_oracle: 0.666666666666667,
    selection_regret: 0.25,
  });
});

Deno.test("undefined rate denominators are null rather than zero", () => {
  const allCorrect = observation("all-correct", [
    candidate(A, "same", true, ["e"]),
    candidate(B, "same", true, ["e"]),
    candidate(C, "same", true, ["e"]),
  ]);
  const report = aggregateEnsembleQuality([allCorrect]);
  assertEquals(
    report.cofailure_matrix.pairs[0].conditional_success_a_given_b_failed,
    null,
  );
  assertEquals(
    report.cofailure_matrix.pairs[0].conditional_success_b_given_a_failed,
    null,
  );

  const noneCorrect = observation("none-correct", [
    candidate(A, "a", false, ["e1"]),
    candidate(B, "b", false, ["e2"]),
    candidate(C, "c", false, ["e3"]),
  ], null);
  assertEquals(
    aggregateEnsembleQuality([noneCorrect]).selection_regret
      .selection_success_given_oracle,
    null,
  );
});

Deno.test("equal two-thirds oracle and best-single rates produce exact zero uplift", () => {
  const observations = [
    observation("equal-rate-1", [
      candidate(A, "a", true, ["e1"]),
      candidate(B, "b", false, ["e2"]),
      candidate(C, "c", false, ["e3"]),
    ], A),
    observation("equal-rate-2", [
      candidate(A, "a", true, ["e4"]),
      candidate(B, "b", true, ["e5"]),
      candidate(C, "c", true, ["e6"]),
    ], B),
    observation("equal-rate-3", [
      candidate(A, "a", false, ["e7"]),
      candidate(B, "b", false, ["e8"]),
      candidate(C, "c", false, ["e9"]),
    ], C),
  ];
  const report = aggregateEnsembleQuality(observations);
  assertAlmostEquals(report.selection_regret.oracle_success_rate, 2 / 3);
  assertAlmostEquals(report.selection_regret.best_single_success_rate, 2 / 3);
  assertEquals(report.selection_regret.oracle_uplift, 0);
  assertEquals(report.selection_regret.captured_uplift, 0);
  assertEquals(report.selection_regret.capture_rate, null);
  EnsembleQualityReportSchema.parse(report);
});

Deno.test("minority reports preserve correct dissent, overturn, ties, and unresolved IDs", () => {
  const reports = aggregateEnsembleQuality(fixture()).minority_reports;
  assertEquals(reports[0], {
    observation_id: "obs-1",
    majority_answer: { conclusion_id: "answer_a", sources: [A, B] },
    minority_reports: [{
      source: C,
      conclusion_id: "answer_c",
      evidence_ids: ["e3"],
      externally_correct: false,
    }],
    minority_supporting_evidence: ["e3"],
    majority_overturn_triggered: true,
    unresolved_disagreement: ["answer_a", "answer_c"],
  });
  assertEquals(reports[1].majority_answer, null);
  assertEquals(reports[1].minority_reports.length, 3);
  assertEquals(reports[1].unresolved_disagreement, [
    "answer_a",
    "answer_b",
    "answer_c",
  ]);
  assertEquals(
    reports[3].minority_reports.filter((item) => item.externally_correct),
    [
      {
        source: A,
        conclusion_id: "answer_a",
        evidence_ids: ["e10"],
        externally_correct: true,
      },
      {
        source: C,
        conclusion_id: "answer_c",
        evidence_ids: ["e12"],
        externally_correct: true,
      },
    ],
  );
});

Deno.test("minority report preserves a correct strict-minority overturn", () => {
  const minorityTruth = observation("minority-truth", [
    candidate(A, "wrong", false, ["majority-a"]),
    candidate(B, "wrong", false, ["majority-b"]),
    candidate(C, "right", true, ["minority-proof"]),
  ], C);
  const report = aggregateEnsembleQuality([minorityTruth]).minority_reports[0];
  assertEquals(report.majority_answer, {
    conclusion_id: "wrong",
    sources: [A, B],
  });
  assertEquals(report.minority_reports, [{
    source: C,
    conclusion_id: "right",
    evidence_ids: ["minority-proof"],
    externally_correct: true,
  }]);
  assertEquals(report.majority_overturn_triggered, true);
});

Deno.test("diversity reports identical, orthogonal, and observable fallback effective votes", () => {
  const identical = aggregateEnsembleQuality([fixture()[0]])
    .real_diversity_scores[0];
  assertAlmostEquals(identical.effective_rank!, 1, 1e-12);
  assertAlmostEquals(identical.effective_vote_count, 1, 1e-12);
  assertEquals(
    identical.effective_vote_count_basis,
    "embedding_effective_rank",
  );
  assertEquals(
    identical.mean_pairwise_observable_reasoning_cosine_similarity,
    1,
  );
  assertEquals(identical.observable_embedding_candidate_count, 3);
  assertEquals(identical.observable_reasoning_pair_count, 3);
  assertEquals(identical.task_expertise_by_source, [
    { source: A, task_expertise_score: 0.9 },
    { source: B, task_expertise_score: null },
    { source: C, task_expertise_score: 0.4 },
  ]);

  const orthogonal = observation("orthogonal", [
    candidate(A, "same", true, ["e"], [1, 0, 0]),
    candidate(B, "same", true, ["e"], [0, 1, 0]),
    candidate(C, "same", true, ["e"], [0, 0, 1]),
  ]);
  const orthogonalScore = aggregateEnsembleQuality([orthogonal])
    .real_diversity_scores[0];
  assertAlmostEquals(orthogonalScore.effective_rank!, 3, 1e-12);
  assertAlmostEquals(orthogonalScore.effective_vote_count, 3, 1e-12);

  const correlated = observation("correlated", [
    candidate(A, "same", true, ["e"], [1, 0]),
    candidate(B, "same", true, ["e"], [0.5, Math.sqrt(0.75)]),
  ]);
  assertAlmostEquals(
    aggregateEnsembleQuality([correlated]).real_diversity_scores[0]
      .effective_rank!,
    1.92862323320368,
    1e-12,
  );

  const largeFinite = observation("large-finite", [
    candidate(A, "same", true, ["e"], [Number.MAX_VALUE, 0]),
    candidate(B, "same", true, ["e"], [Number.MAX_VALUE, 0]),
  ]);
  const largeFiniteScore = aggregateEnsembleQuality([largeFinite])
    .real_diversity_scores[0];
  assertEquals(
    largeFiniteScore.mean_pairwise_observable_reasoning_cosine_similarity,
    1,
  );
  assertAlmostEquals(largeFiniteScore.effective_rank!, 1, 1e-12);

  const noEmbeddings = fixture()[1];
  const fallback = aggregateEnsembleQuality([noEmbeddings])
    .real_diversity_scores[0];
  assertEquals(
    fallback.mean_pairwise_observable_reasoning_cosine_similarity,
    null,
  );
  assertEquals(fallback.observable_embedding_candidate_count, 0);
  assertEquals(fallback.observable_reasoning_pair_count, 0);
  assertEquals(fallback.effective_rank, null);
  assertEquals(fallback.observable_signature_count, 3);
  assertEquals(fallback.effective_vote_count, 3);
  assertEquals(
    fallback.effective_vote_count_basis,
    "observable_signature_count",
  );
});

Deno.test("diversity formulas are normalized and evidence IDs are sorted", () => {
  const score =
    aggregateEnsembleQuality([fixture()[0]]).real_diversity_scores[0];
  assertAlmostEquals(score.normalized_conclusion_diversity, 2 / 3, 1e-12);
  assertAlmostEquals(
    score.mean_pairwise_evidence_jaccard_distance,
    5 / 6,
    1e-12,
  );
  assert(score.normalized_conclusion_diversity >= 0);
  assert(score.normalized_conclusion_diversity <= 1);
});

Deno.test("ensemble quality is invariant to observation and candidate order", () => {
  const expected = aggregateEnsembleQuality(fixture());
  const reversed = fixture().reverse().map((item) => ({
    ...item,
    candidates: [...item.candidates].reverse(),
  }));
  assertEquals(aggregateEnsembleQuality(reversed), expected);
});

Deno.test("ensemble quality rejects duplicate IDs, sources, evidence, panel drift, and unknown selection", () => {
  const valid = fixture()[0];
  const invalid = [
    [valid, { ...valid }],
    [observation("duplicate-source", [
      valid.candidates[0],
      valid.candidates[0],
    ])],
    [observation("duplicate-evidence", [
      candidate(A, "a", true, ["same", "same"]),
      candidate(B, "b", false, ["other"]),
    ])],
    [
      valid,
      observation("drift", [
        candidate(A, "a", true, ["e"]),
        candidate(B, "b", true, ["e"]),
        candidate({ provider: "delta", model: "d-1" }, "d", false, ["e"]),
      ]),
    ],
    [
      valid,
      { ...fixture()[1], observation_id: "bucket-drift", task_type: "math" },
    ],
    [observation("unknown-selection", [
      candidate(A, "a", true, ["e"]),
      candidate(B, "b", false, ["e"]),
    ], C)],
  ];
  for (const value of invalid) {
    assertThrows(() => aggregateEnsembleQuality(value));
  }
});

Deno.test("strict schemas reject unknown/private fields and malformed bounds", () => {
  const base = fixture()[0];
  for (
    const extra of [
      { prompt: "secret" },
      { response: "secret" },
      { credentials: "secret" },
      { notes: "freeform" },
    ]
  ) {
    assertThrows(() =>
      EnsembleQualityObservationSchema.parse({ ...base, ...extra })
    );
  }
  assertThrows(() =>
    EnsembleQualityObservationSchema.parse({
      ...base,
      candidates: [
        { ...base.candidates[0], raw_reasoning: "private" },
        base.candidates[1],
      ],
    })
  );

  for (const task_type of ["Not Canonical", "UPPER", "", "a".repeat(129)]) {
    assertThrows(() =>
      EnsembleQualityObservationSchema.parse({ ...base, task_type })
    );
  }
  assertThrows(() => aggregateEnsembleQuality([]));
  assertThrows(() =>
    aggregateEnsembleQuality(
      Array.from(
        { length: MAX_ENSEMBLE_QUALITY_OBSERVATIONS + 1 },
        (_, index) => ({
          ...base,
          observation_id: `obs-${index}`,
        }),
      ),
    )
  );
  assertThrows(() =>
    EnsembleQualityObservationSchema.parse({
      ...base,
      evaluated_at: "not-a-date",
    })
  );
  assertThrows(() =>
    EnsembleQualityObservationSchema.parse({
      ...base,
      candidates: [base.candidates[0]],
    })
  );
  assertThrows(() =>
    EnsembleQualityObservationSchema.parse({
      ...base,
      candidates: Array.from({ length: 17 }, (_, index) =>
        candidate({ provider: `p-${index}`, model: "m" }, "same", true, ["e"])),
    })
  );
  assertThrows(() =>
    EnsembleQualityObservationSchema.parse({
      ...base,
      candidates: [
        candidate(
          A,
          "a",
          true,
          Array.from({ length: 257 }, (_, index) => `e-${index}`),
        ),
        base.candidates[1],
      ],
    })
  );
  assertThrows(() =>
    EnsembleQualityObservationSchema.parse({
      ...base,
      candidates: [
        {
          ...base.candidates[0],
          task_expertise_score: Number.POSITIVE_INFINITY,
        },
        base.candidates[1],
      ],
    })
  );
});

Deno.test("embedding policy rejects nonfinite, over-dimensioned, zero, and inconsistent vectors", () => {
  const badVectors = [
    [Number.NaN, 1],
    [Number.POSITIVE_INFINITY, 1],
    Array.from({ length: 257 }, () => 1),
    [0, 0],
  ];
  for (const vector of badVectors) {
    assertThrows(() =>
      EnsembleQualityObservationSchema.parse(observation("bad", [
        candidate(A, "a", true, ["e"], vector),
        candidate(B, "b", false, ["f"], [1, 0]),
      ]))
    );
  }
  assertThrows(() =>
    EnsembleQualityObservationSchema.parse(observation("dims", [
      candidate(A, "a", true, ["e"], [1, 0]),
      candidate(B, "b", false, ["f"], [1, 0, 0]),
    ]))
  );
});

Deno.test("report schema rejects contradictory derived metrics and windows", () => {
  const report = aggregateEnsembleQuality(fixture());
  assertThrows(() =>
    EnsembleQualityReportSchema.parse({
      ...report,
      cofailure_matrix: {
        ...report.cofailure_matrix,
        all_model_cofailure_beta: {
          ...report.cofailure_matrix.all_model_cofailure_beta,
          observed_rate: 0,
        },
      },
    })
  );
  assertThrows(() =>
    EnsembleQualityReportSchema.parse({
      ...report,
      selection_regret: {
        ...report.selection_regret,
        selection_regret: 0,
      },
    })
  );
  assertThrows(() =>
    EnsembleQualityReportSchema.parse({
      ...report,
      evaluation_window: {
        started_at: "2026-07-15T00:00:00Z",
        ended_at: "2026-07-14T00:00:00Z",
      },
    })
  );
});

Deno.test("report carries no prompts, responses, raw reasoning, or routing authority", () => {
  const serialized = JSON.stringify(aggregateEnsembleQuality(fixture()))
    .toLowerCase();
  for (
    const forbidden of [
      "prompt",
      "response",
      "credential",
      "raw_reasoning",
      "reasoning_text",
      "observable_reasoning_embedding",
      "routing_weight",
      "routing_rank",
      "eligible",
      "invoke",
      "synthesis",
      "authority",
    ]
  ) assertEquals(serialized.includes(forbidden), false, forbidden);
});
