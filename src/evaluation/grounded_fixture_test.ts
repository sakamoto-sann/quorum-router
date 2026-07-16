import {
  assert,
  assertEquals,
  assertStringIncludes,
  assertThrows,
} from "@std/assert";
import { validateGroundedNonAnswerCorpus } from "./grounded_fixture.ts";

async function loadCorpus(): Promise<unknown> {
  return JSON.parse(
    await Deno.readTextFile(
      "examples/grounded-non-answer-evaluator-corpus.json",
    ),
  );
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

type FixtureIdentity = {
  principal_type: string;
  provider_id: string;
  model_id: string;
  model_revision: string;
  operator_domain: string;
  evaluator_config_hash: string;
};

type MutableCorpusFixture = {
  label_policy: {
    training_use: string;
  };
  cases: Array<{
    contract: {
      requirements: Array<{ description?: string }>;
      unsupported_claim_taxonomy_version: string;
    };
    candidate_source: FixtureIdentity;
    label_provenance: { provisional: boolean };
    available_evaluators?: FixtureIdentity[];
    evaluator_results?: Array<Record<string, unknown>>;
    expected: {
      requirement_results: Array<{
        candidate_span_text: string | null;
        evidence_ids: string[];
      }>;
      evaluator: FixtureIdentity | null;
      unsupported_claims: Array<Record<string, unknown>>;
      unsupported_claim_count: number;
      abstention_reason: string | null;
      asks_for_available_evidence: boolean;
      evaluation_reason: string;
      selection_changed: boolean;
    };
  }>;
};

Deno.test("grounded non-answer Phase 0 corpus passes strict runtime validation", async () => {
  const corpus = await loadCorpus();
  validateGroundedNonAnswerCorpus(corpus);

  const value = corpus as {
    cases: Array<{ expected: { status: string | null } }>;
  };
  assertEquals(
    [...new Set(value.cases.map((testCase) => testCase.expected.status))]
      .filter((status): status is string => status !== null)
      .sort(),
    ["abstained", "invalid", "non_answer", "qualified"],
  );
});

Deno.test("grounded non-answer validator rejects false-assurance fixture mutations", async () => {
  const original = await loadCorpus() as MutableCorpusFixture;
  const mutations: Array<{
    name: string;
    mutate: (corpus: MutableCorpusFixture) => void;
    message: string;
  }> = [
    {
      name: "missing requirement description",
      mutate: (corpus) =>
        delete corpus.cases[0].contract.requirements[0].description,
      message: "expected keys",
    },
    {
      name: "candidate span not present",
      mutate: (corpus) => {
        corpus.cases[0].expected.requirement_results[0].candidate_span_text =
          "fabricated absent span";
      },
      message: "exact candidate span",
    },
    {
      name: "qualified result cites unknown evidence",
      mutate: (corpus) => {
        corpus.cases[0].expected.requirement_results[0].evidence_ids = ["E999"];
      },
      message: "known evidence",
    },
    {
      name: "self evaluation",
      mutate: (corpus) => {
        corpus.cases[0].expected.evaluator = corpus.cases[0].candidate_source;
      },
      message: "not independent",
    },
    {
      name: "unsupported claim hidden under qualified status",
      mutate: (corpus) => {
        corpus.cases[0].expected.unsupported_claim_count = 1;
      },
      message: "derived from unsupported_claims",
    },
    {
      name: "unapproved abstention reason",
      mutate: (corpus) => {
        corpus.cases[2].expected.abstention_reason = "provider-was-slow";
      },
      message: "abstention is not contract-grounded",
    },
    {
      name: "abstention cannot request evidence already supplied",
      mutate: (corpus) => {
        corpus.cases[2].expected.asks_for_available_evidence = true;
      },
      message: "abstention is not contract-grounded",
    },
    {
      name: "abstention cannot cite fabricated evidence",
      mutate: (corpus) => {
        corpus.cases[2].expected.requirement_results[0].evidence_ids = ["E999"];
      },
      message: "abstention is not contract-grounded",
    },
    {
      name: "shadow result changes selection",
      mutate: (corpus) => {
        corpus.cases[0].expected.selection_changed = true;
      },
      message: "cannot change selection",
    },
    {
      name: "disputed case without disagreement",
      mutate: (corpus) => {
        const secondEvaluator = corpus.cases[9].evaluator_results![1].evaluator;
        const duplicate = clone(corpus.cases[9].evaluator_results![0]);
        duplicate.evaluator = secondEvaluator;
        corpus.cases[9].evaluator_results![1] = duplicate;
      },
      message: "actual disagreement",
    },
    {
      name: "disputed results require valid statuses",
      mutate: (corpus) => {
        corpus.cases[9].evaluator_results![1].status = "banana";
      },
      message: "unsupported status",
    },
    {
      name: "disputed evaluators must be pairwise independent",
      mutate: (corpus) => {
        corpus.cases[9].evaluator_results![1].evaluator =
          corpus.cases[9].evaluator_results![0].evaluator;
      },
      message: "pairwise independent",
    },
    {
      name: "unevaluated case despite independent evaluator",
      mutate: (corpus) => {
        corpus.cases[8].available_evaluators!.push({
          principal_type: "model",
          provider_id: "beta",
          model_id: "judge-b",
          model_revision: "fixture-v1",
          operator_domain: "org-beta",
          evaluator_config_hash: `sha256:${"2".repeat(64)}`,
        });
      },
      message: "independent evaluator exists",
    },
    {
      name: "same provider alias is not independent",
      mutate: (corpus) => {
        corpus.cases[0].expected.evaluator!.provider_id = "alpha";
      },
      message: "not independent",
    },
    {
      name: "fixture labels cannot become training data",
      mutate: (corpus) => {
        corpus.label_policy.training_use = "allowed";
      },
      message: "provisional and non-authoritative",
    },
    {
      name: "case provenance cannot claim adjudication",
      mutate: (corpus) => {
        corpus.cases[0].label_provenance.provisional = false;
      },
      message: "provisional and unadjudicated",
    },
    {
      name: "unsupported claim taxonomy is versioned",
      mutate: (corpus) => {
        corpus.cases[0].contract.unsupported_claim_taxonomy_version =
          "quorum-router.unsupported-claim.v2";
      },
      message: "unsupported taxonomy",
    },
    {
      name: "evaluation state carries a closed reason code",
      mutate: (corpus) => {
        corpus.cases[0].expected.evaluation_reason = "maybe";
      },
      message: "reason does not match state",
    },
  ];

  for (const mutation of mutations) {
    const mutated = clone(original);
    mutation.mutate(mutated);
    const error = assertThrows(
      () => validateGroundedNonAnswerCorpus(mutated),
      Error,
      mutation.message,
    );
    assertStringIncludes(error.message, mutation.message, mutation.name);
  }
});

Deno.test("dispute predicate includes canonical requirement results, not status only", async () => {
  const corpus = await loadCorpus() as MutableCorpusFixture;
  const disputed = corpus.cases[9].evaluator_results!;
  disputed[1].status = disputed[0].status;
  validateGroundedNonAnswerCorpus(corpus);
});

Deno.test("grounded non-answer proposal remains post-selection and advisory only", async () => {
  const docs = await Deno.readTextFile(
    "docs/grounded-non-answer-evaluator.md",
  );
  const readme = await Deno.readTextFile("README.md");
  const runtimeRouter = await Deno.readTextFile("router.ts");
  const compatibilityBarrel = await Deno.readTextFile("src/router.ts");

  for (
    const required of [
      "do not change routing behavior",
      "advisory_only: true",
      "hidden reasoning",
      "existing selection is fixed before shadow evaluation",
      "syntactic anti-collision check",
      'evaluation_state: "evaluated" | "unevaluated" | "disputed"',
      "Every other disagreement emits a `disputed` envelope",
      "NO_QUALIFIED_ANSWER",
      "No phrase blacklist",
      "No SafeLoop policy or receipt changes",
      "No Gemini dependency or invocation",
      "No v0.1.20 version bump or release action",
      "post-selection measurement only",
      "strict offline fixture validator",
      "training use and gold-measurement use",
      "Agreement is not proof of truth",
    ]
  ) {
    assertStringIncludes(docs, required);
  }
  assertStringIncludes(
    readme,
    "docs/grounded-non-answer-evaluator.md",
  );
  assert(!docs.includes("production routing enabled"));
  assert(!docs.includes("Add qualification before scalar ranking"));
  assert(!runtimeRouter.includes("grounded_fixture"));
  assert(!compatibilityBarrel.includes("grounded_fixture"));
  assert(!runtimeRouter.includes("grounded_shadow"));
  assert(!compatibilityBarrel.includes("grounded_shadow"));
});
