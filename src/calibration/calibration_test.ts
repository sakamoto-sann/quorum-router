import { assertEquals, assertThrows } from "@std/assert";
import {
  aggregateHierarchicalTaskCalibration,
  aggregateTaskCalibration,
  HierarchicalTaskCalibrationDecisionSchema,
  HierarchicalTaskCalibrationObservationSchema,
  MAX_CALIBRATION_OBSERVATIONS,
  resolveHierarchicalTaskCalibration,
  TaskCalibrationObservationSchema,
  TaskCalibrationReportSchema,
} from "../../router.ts";

function observation(overrides: Record<string, unknown> = {}) {
  return {
    observation_id: "obs-1",
    task_type: "code_review",
    source: {
      provider: "OpenAI",
      model: "gpt-5",
    },
    evaluation_basis: "caller_attested_external_ground_truth",
    correct: true,
    confidence: 0.8,
    evaluated_at: "2026-07-13T00:00:00Z",
    ...overrides,
  };
}

Deno.test("task calibration rejects invalid and non-ground-truth observations", () => {
  const invalidObservations = [
    observation({ observation_id: "" }),
    observation({ task_type: "   " }),
    observation({ source: { provider: "", model: "gpt-5" } }),
    observation({ source: { provider: "OpenAI", model: "   " } }),
    observation({ evaluation_basis: "external_ground_truth" }),
    observation({ evaluation_basis: "decision_report" }),
    observation({ correct: 1 }),
    observation({ confidence: -0.01 }),
    observation({ confidence: 1.01 }),
    observation({ confidence: Number.NaN }),
    observation({ confidence: Number.POSITIVE_INFINITY }),
    observation({ evaluated_at: "yesterday" }),
    observation({ prompt: "secret prompt" }),
    observation({ response: "secret response" }),
    observation({ credentials: "secret" }),
    observation({ notes: "freeform evaluation notes" }),
  ];

  for (const candidate of invalidObservations) {
    assertThrows(() => TaskCalibrationObservationSchema.parse(candidate));
  }
});

Deno.test("task calibration rejects duplicate observation ids", () => {
  assertThrows(
    () =>
      aggregateTaskCalibration([
        observation(),
        observation({
          task_type: "summarization",
          source: { provider: "Anthropic", model: "claude" },
        }),
      ]),
    Error,
    "unique",
  );
});

Deno.test("task calibration separates task types for the same source", () => {
  const result = aggregateTaskCalibration([
    observation({ observation_id: "review", task_type: "code_review" }),
    observation({
      observation_id: "summary",
      task_type: "summarization",
      correct: false,
    }),
  ], { minimum_sample_count: 1 });

  assertEquals(result.groups.length, 2);
  assertEquals(
    result.groups.map((group) => [group.task_type, group.accuracy]),
    [["code_review", 1], ["summarization", 0]],
  );
});

Deno.test("task calibration separates provider/model sources for the same task", () => {
  const result = aggregateTaskCalibration([
    observation({ observation_id: "openai" }),
    observation({
      observation_id: "anthropic",
      source: { provider: "Anthropic", model: "claude" },
      correct: false,
    }),
  ], { minimum_sample_count: 1 });

  assertEquals(result.groups.length, 2);
  assertEquals(
    result.groups.map((group) => [
      group.source.provider,
      group.source.model,
      group.accuracy,
    ]),
    [["Anthropic", "claude", 0], ["OpenAI", "gpt-5", 1]],
  );
});

Deno.test("task calibration computes exact transparent group metrics", () => {
  const result = aggregateTaskCalibration([
    observation({
      observation_id: "correct",
      confidence: 0.8,
      correct: true,
    }),
    observation({
      observation_id: "incorrect",
      confidence: 0.6,
      correct: false,
      evaluated_at: "2026-07-13T00:01:00Z",
    }),
  ], { minimum_sample_count: 2 });

  assertEquals(result, {
    schema_version: "quorum-router.calibration-by-task.v1",
    advisory_only: true,
    minimum_sample_count: 2,
    groups: [{
      task_type: "code_review",
      source: { provider: "OpenAI", model: "gpt-5" },
      sample_count: 2,
      accuracy: 0.5,
      mean_confidence: 0.7,
      brier_score: 0.2,
      mean_calibration_bias: 0.2,
      sample_status: "sufficient",
    }],
  });
});

Deno.test("task calibration exposes signed mean bias rather than ECE", () => {
  const result = aggregateTaskCalibration([
    observation({
      observation_id: "overconfident-error",
      confidence: 1,
      correct: false,
    }),
    observation({
      observation_id: "underconfident-success",
      confidence: 0,
      correct: true,
    }),
  ], { minimum_sample_count: 1 });

  assertEquals(result.groups[0].mean_calibration_bias, 0);
  assertEquals(result.groups[0].brier_score, 1);
  assertEquals("calibration_gap" in result.groups[0], false);
  assertEquals("ece" in result.groups[0], false);
});

Deno.test("task calibration accepts empty input without inventing groups", () => {
  const result = aggregateTaskCalibration([]);

  assertEquals(result.groups, []);
});

Deno.test("task calibration defaults to 20 samples and marks small groups insufficient", () => {
  const result = aggregateTaskCalibration([observation()]);

  assertEquals(result.minimum_sample_count, 20);
  assertEquals(result.groups[0].sample_count, 1);
  assertEquals(result.groups[0].sample_status, "insufficient");
  assertEquals("trusted" in result.groups[0], false);
});

Deno.test("task calibration output contains no routing or execution authority", () => {
  const result = aggregateTaskCalibration([observation()], {
    minimum_sample_count: 1,
  });
  const serialized = JSON.stringify(result).toLowerCase();
  const forbidden = [
    "prompt",
    "response",
    "credential",
    "freeform",
    "weight",
    "rank",
    "exclude",
    "execution",
    "authority",
    "statistical_power",
    "representative",
    "routing_fitness",
    "validity",
  ];

  for (const field of forbidden) {
    assertEquals(serialized.includes(field), false, field);
  }
});

Deno.test("task calibration validates minimum sample configuration", () => {
  for (
    const minimum_sample_count of [
      0,
      -1,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.MAX_SAFE_INTEGER + 1,
    ]
  ) {
    assertThrows(() =>
      aggregateTaskCalibration([observation()], { minimum_sample_count })
    );
  }
});

Deno.test("task calibration rejects malformed offsets and invisible identifiers", () => {
  for (
    const candidate of [
      observation({ evaluated_at: "2026-07-13T00:00:00+24:00" }),
      observation({ evaluated_at: "2026-07-13T00:00:00+99:99" }),
      observation({ evaluated_at: "2026-07-13T00:00:00+09:60" }),
      observation({ observation_id: "\u200B" }),
      observation({ observation_id: "obs\u200B-1" }),
      observation({ observation_id: "obs\uFE0F-1" }),
      observation({ observation_id: "obs\u034F-1" }),
    ]
  ) {
    assertThrows(() => TaskCalibrationObservationSchema.parse(candidate));
  }

  TaskCalibrationObservationSchema.parse(
    observation({ evaluated_at: "2026-07-13T00:00:00+23:59" }),
  );
  TaskCalibrationObservationSchema.parse(
    observation({ evaluated_at: "2026-07-13T00:00:00Z" }),
  );
});

Deno.test("task calibration normalizes identifiers before duplicate checks", () => {
  assertThrows(() =>
    aggregateTaskCalibration([
      observation({ observation_id: "é" }),
      observation({ observation_id: "e\u0301" }),
    ])
  );
});

Deno.test("task calibration output is invariant to observation order", () => {
  const observations = [
    observation({ observation_id: "large", correct: false, confidence: 1 }),
    ...Array.from({ length: 9_999 }, (_, index) =>
      observation({
        observation_id: `small-${index}`,
        correct: false,
        confidence: 1e-14,
      })),
  ];

  assertEquals(
    aggregateTaskCalibration(observations, { minimum_sample_count: 1 }),
    aggregateTaskCalibration([...observations].reverse(), {
      minimum_sample_count: 1,
    }),
  );
});

Deno.test("task calibration group order uses deterministic code-unit ordering", () => {
  const composed = observation({ observation_id: "1", task_type: "é" });
  const decomposed = observation({
    observation_id: "2",
    task_type: "e\u0301",
  });

  assertEquals(
    aggregateTaskCalibration([composed, decomposed], {
      minimum_sample_count: 1,
    }),
    aggregateTaskCalibration([decomposed, composed], {
      minimum_sample_count: 1,
    }),
  );
});

Deno.test("task calibration enforces bounded labels and batches", () => {
  assertThrows(() =>
    TaskCalibrationObservationSchema.parse(
      observation({ task_type: "x".repeat(257) }),
    )
  );
  assertThrows(() =>
    aggregateTaskCalibration(
      Array.from(
        { length: MAX_CALIBRATION_OBSERVATIONS + 1 },
        (_, index) => observation({ observation_id: `obs-${index}` }),
      ),
    )
  );
  assertThrows(() =>
    aggregateTaskCalibration([], {
      minimum_sample_count: MAX_CALIBRATION_OBSERVATIONS + 1,
    })
  );
});

Deno.test("task calibration report schema rejects contradictory groups", () => {
  const valid = aggregateTaskCalibration([observation()], {
    minimum_sample_count: 1,
  });
  const group = valid.groups[0];

  for (
    const invalidGroup of [
      { ...group, sample_count: 0 },
      { ...group, sample_status: "insufficient" },
      { ...group, mean_calibration_bias: 0 },
    ]
  ) {
    assertThrows(() =>
      TaskCalibrationReportSchema.parse({
        ...valid,
        groups: [invalidGroup],
      })
    );
  }

  assertThrows(() =>
    TaskCalibrationReportSchema.parse({
      ...valid,
      groups: [group, group],
    })
  );
});

Deno.test("hierarchical calibration accepts canonical labels but rejects raw prompts and orphan patterns", () => {
  const base = observation();
  HierarchicalTaskCalibrationObservationSchema.parse({
    ...base,
    task_subtype: "typescript",
    prompt_pattern: "schema-boundary-review",
  });
  assertThrows(() =>
    HierarchicalTaskCalibrationObservationSchema.parse({
      ...base,
      task_subtype: "typescript",
      prompt_pattern: "Review this schema boundary carefully",
    })
  );
  assertThrows(() =>
    HierarchicalTaskCalibrationObservationSchema.parse({
      ...base,
      task_subtype: "TypeScript",
      prompt_pattern: "schema-boundary-review",
    })
  );
  for (
    const candidate of [
      observation({ prompt_pattern: "schema-boundary-review" }),
      observation({ task_subtype: " ", prompt_pattern: "pattern" }),
      observation({ task_subtype: "typescript", raw_prompt: "review this" }),
    ]
  ) {
    assertThrows(() =>
      HierarchicalTaskCalibrationObservationSchema.parse(candidate)
    );
  }
});

Deno.test("hierarchical calibration emits task, subtype, and pattern groups", () => {
  const report = aggregateHierarchicalTaskCalibration([
    observation({
      observation_id: "pattern-1",
      task_subtype: "typescript",
      prompt_pattern: "schema-boundary-review",
    }),
    observation({
      observation_id: "subtype-only",
      task_subtype: "typescript",
      correct: false,
      confidence: 0.6,
    }),
    observation({
      observation_id: "obs-only",
      correct: true,
      confidence: 0.7,
    }),
  ], { minimum_sample_count: 2 });

  assertEquals(
    report.groups.map((group) => [
      group.scope,
      group.task_subtype,
      group.prompt_pattern,
      group.sample_count,
      group.sample_status,
    ]),
    [
      ["task_type", undefined, undefined, 3, "sufficient"],
      ["task_subtype", "typescript", undefined, 2, "sufficient"],
      [
        "prompt_pattern",
        "typescript",
        "schema-boundary-review",
        1,
        "insufficient",
      ],
    ],
  );
});

Deno.test("hierarchical calibration resolves pattern then falls back through subtype to task", () => {
  const report = aggregateHierarchicalTaskCalibration([
    observation({
      observation_id: "pattern-1",
      task_subtype: "typescript",
      prompt_pattern: "schema-boundary-review",
    }),
    observation({
      observation_id: "subtype-2",
      task_subtype: "typescript",
    }),
    observation({ observation_id: "obs-3" }),
  ], { minimum_sample_count: 2 });
  const query = {
    task_type: "code_review",
    task_subtype: "typescript",
    prompt_pattern: "schema-boundary-review",
    source: { provider: "OpenAI", model: "gpt-5" },
  };

  const selection = resolveHierarchicalTaskCalibration(report, query);

  assertEquals(selection.requested_scope, "prompt_pattern");
  assertEquals(selection.resolution_status, "selected");
  assertEquals(selection.selected_scope, "task_subtype");
  assertEquals(selection.candidates, [
    {
      scope: "prompt_pattern",
      sample_count: 1,
      sample_status: "insufficient",
    },
    {
      scope: "task_subtype",
      sample_count: 2,
      sample_status: "sufficient",
    },
    {
      scope: "task_type",
      sample_count: 3,
      sample_status: "sufficient",
    },
  ]);
  assertEquals(selection.selected_group?.scope, "task_subtype");
});

Deno.test("hierarchical calibration selects a sufficient pattern and reports no selection when all levels are insufficient", () => {
  const sufficient = aggregateHierarchicalTaskCalibration([
    observation({
      observation_id: "p1",
      task_subtype: "typescript",
      prompt_pattern: "schema-boundary-review",
    }),
    observation({
      observation_id: "p2",
      task_subtype: "typescript",
      prompt_pattern: "schema-boundary-review",
    }),
  ], { minimum_sample_count: 2 });
  const query = {
    task_type: "code_review",
    task_subtype: "typescript",
    prompt_pattern: "schema-boundary-review",
    source: { provider: "OpenAI", model: "gpt-5" },
  };

  assertEquals(
    resolveHierarchicalTaskCalibration(sufficient, query).selected_scope,
    "prompt_pattern",
  );

  const insufficient = aggregateHierarchicalTaskCalibration([
    observation({
      task_subtype: "typescript",
      prompt_pattern: "schema-boundary-review",
    }),
  ], { minimum_sample_count: 2 });
  const selection = resolveHierarchicalTaskCalibration(insufficient, query);
  assertEquals(selection.resolution_status, "no_sufficient_group");
  assertEquals(selection.selected_scope, null);
  assertEquals(selection.selected_group, undefined);
});

Deno.test("hierarchical calibration uses structured keys for delimiter-bearing labels", () => {
  const report = aggregateHierarchicalTaskCalibration([
    observation({
      observation_id: "delimiter-1",
      task_subtype: "a:b",
      prompt_pattern: "c/d",
    }),
    observation({
      observation_id: "delimiter-2",
      task_subtype: "a",
      prompt_pattern: "b:c/d",
    }),
  ], { minimum_sample_count: 1 });

  assertEquals(
    report.groups.filter((group) => group.scope === "prompt_pattern").map(
      (group) => [group.task_subtype, group.prompt_pattern],
    ),
    [["a", "b:c/d"], ["a:b", "c/d"]],
  );
});

Deno.test("hierarchical calibration never crosses provider or model boundaries", () => {
  const report = aggregateHierarchicalTaskCalibration([
    observation({
      observation_id: "openai",
      task_subtype: "typescript",
      prompt_pattern: "schema-boundary-review",
    }),
    observation({
      observation_id: "anthropic",
      task_subtype: "typescript",
      prompt_pattern: "schema-boundary-review",
      source: { provider: "Anthropic", model: "claude" },
    }),
  ], { minimum_sample_count: 2 });

  const selection = resolveHierarchicalTaskCalibration(report, {
    task_type: "code_review",
    task_subtype: "typescript",
    prompt_pattern: "schema-boundary-review",
    source: { provider: "OpenAI", model: "gpt-5" },
  });
  assertEquals(selection.resolution_status, "no_sufficient_group");
  assertEquals(selection.candidates[0].sample_count, 1);
});

Deno.test("hierarchical calibration decision schema rejects report-selection contradictions", () => {
  const report = aggregateHierarchicalTaskCalibration([
    observation({
      observation_id: "p1",
      task_subtype: "typescript",
      prompt_pattern: "schema-boundary-review",
    }),
    observation({
      observation_id: "p2",
      task_subtype: "typescript",
      prompt_pattern: "schema-boundary-review",
    }),
  ], { minimum_sample_count: 2 });
  const selection = resolveHierarchicalTaskCalibration(report, {
    task_type: "code_review",
    task_subtype: "typescript",
    prompt_pattern: "schema-boundary-review",
    source: { provider: "OpenAI", model: "gpt-5" },
  });

  HierarchicalTaskCalibrationDecisionSchema.parse({ report, selection });
  assertThrows(() =>
    HierarchicalTaskCalibrationDecisionSchema.parse({
      report,
      selection: {
        ...selection,
        candidates: selection.candidates.map((candidate, index) =>
          index === 0 ? { ...candidate, sample_count: 1 } : candidate
        ),
      },
    })
  );
  assertThrows(() =>
    HierarchicalTaskCalibrationDecisionSchema.parse({
      report,
      selection: {
        ...selection,
        selected_group: {
          ...selection.selected_group,
          source: { provider: "Anthropic", model: "claude" },
        },
      },
    })
  );
});
