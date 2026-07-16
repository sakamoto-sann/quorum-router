import { assertEquals, assertRejects } from "@std/assert";
import {
  resolveGroundedShadowEvaluations,
  type ShadowEvaluatorIdentity,
  type ShadowQualification,
  type ShadowTaskContract,
} from "./grounded_shadow.ts";

const candidate =
  "Evidence E1 proves the deliverable. Evidence E2 confirms the check.";
const candidateSha256 =
  "sha256:b05062e7f06ef2a6394957a595cf74f0cc1959602c6655b4ccf637589167f16a";

function identity(
  provider: string,
  operator: string,
  fill: string,
): ShadowEvaluatorIdentity {
  return {
    principal_type: "model",
    provider_id: provider,
    model_id: `${provider}-model`,
    model_revision: "2026-07-16",
    operator_domain: operator,
    evaluator_config_hash: `sha256:${fill.repeat(64)}`,
  };
}

const candidateSource = identity(
  "candidate-provider",
  "candidate.example",
  "1",
);
const evaluatorA = identity("evaluator-a", "operator-a.example", "2");
const evaluatorB = identity("evaluator-b", "operator-b.example", "3");

const contract: ShadowTaskContract = {
  schema_version: "quorum-router.shadow.contract.v1",
  task_id_hash:
    "sha256:5458a3b6216ba9ca3e7fa6c71ea0fd9b2b2a69cdcfdecaf5438ebfd03954f40f",
  task_type: "implementation_review",
  requirements: [
    {
      id: "R1",
      description: "Complete the deliverable",
      required: true,
      impact: "high",
    },
    {
      id: "R2",
      description: "Report the verification",
      required: true,
      impact: "standard",
    },
  ],
  available_evidence: [
    { id: "E1", description: "Deliverable receipt" },
    { id: "E2", description: "Verification receipt" },
  ],
  allowed_abstention_reasons: ["missing_required_receipt"],
  abstention_taxonomy_version: "quorum-router.abstention.v1",
  unsupported_claim_taxonomy_version: "quorum-router.unsupported-claim.v1",
  prohibited_claim_types: [
    "external_action_without_receipt",
    "verification_without_evidence",
    "fabricated_evidence_identifier",
  ],
  second_evaluator_confidence_below: 0.8,
};

function span(text: string): readonly [number, number] {
  const start = candidate.indexOf(text);
  if (start < 0) throw new Error(`missing test span: ${text}`);
  return [start, start + text.length];
}

function qualified(
  evaluator: ShadowEvaluatorIdentity,
  options: { reverse?: boolean; confidence?: number } = {},
): ShadowQualification {
  const requirements = [
    {
      id: "R1",
      satisfied: true,
      candidate_span: span("Evidence E1 proves the deliverable."),
      evidence_ids: ["E1"],
    },
    {
      id: "R2",
      satisfied: true,
      candidate_span: span("Evidence E2 confirms the check."),
      evidence_ids: ["E2"],
    },
  ];
  return {
    schema_version: "quorum-router.shadow-qualification.v1",
    advisory_only: true,
    candidate_sha256: candidateSha256,
    task_id_hash: contract.task_id_hash,
    status: "qualified",
    requirements: options.reverse ? [...requirements].reverse() : requirements,
    asks_for_available_evidence: false,
    unsupported_claims: [],
    unsupported_claim_count: 0,
    abstention_reason: null,
    confidence: options.confidence ?? 0.95,
    evaluator,
  };
}

function resolve(results: ReadonlyArray<unknown>) {
  return resolveGroundedShadowEvaluations({
    contract,
    candidate,
    candidate_source: candidateSource,
    evaluator_results: results,
  });
}

Deno.test("two independent canonical qualified records produce an advisory qualifying envelope", async () => {
  const result = await resolve([
    qualified(evaluatorA, { confidence: 0.91 }),
    qualified(evaluatorB, { reverse: true, confidence: 0.99 }),
  ]);

  assertEquals(result.evaluation_state, "evaluated");
  assertEquals(result.evaluation_reason, "completed");
  assertEquals(result.shadow_disposition, "offline_match_qualified");
  assertEquals(result.simulation_result, "QUALIFIED_CANDIDATES_PRESENT");
  assertEquals(result.selection_changed, false);
  assertEquals(result.evaluator_results.length, 2);
  assertEquals(result.qualification?.status, "qualified");
});

Deno.test("zero or one valid result fails closed without treating one judge as agreement", async () => {
  assertEquals(await resolve([]), {
    schema_version: "quorum-router.shadow-evaluation-envelope.v1",
    advisory_only: true,
    evaluation_state: "unevaluated",
    evaluation_reason: "no_independent_evaluator",
    evaluation_reasons: ["no_evaluator_result"],
    qualification: null,
    evaluator_results: [],
    shadow_disposition: "offline_unavailable",
    simulation_result: "NO_QUALIFIED_ANSWER",
    selection_changed: false,
  });

  const one = await resolve([qualified(evaluatorA)]);
  assertEquals(one.evaluation_state, "unevaluated");
  assertEquals(one.evaluation_reason, "insufficient_valid_independent_results");
  assertEquals(one.evaluator_results.length, 1);
});

Deno.test("candidate-correlated and evaluator-correlated identities fail closed", async () => {
  const sameCandidateProvider = identity(
    candidateSource.provider_id,
    "independent-operator.example",
    "4",
  );
  const candidateCorrelated = await resolve([
    qualified(sameCandidateProvider),
    qualified(evaluatorB),
  ]);
  assertEquals(candidateCorrelated.evaluation_state, "unevaluated");
  assertEquals(candidateCorrelated.evaluator_results.length, 1);

  const sameEvaluatorOperator = identity(
    "evaluator-c",
    evaluatorA.operator_domain,
    "5",
  );
  const evaluatorCorrelated = await resolve([
    qualified(evaluatorA),
    qualified(sameEvaluatorOperator),
  ]);
  assertEquals(evaluatorCorrelated.evaluation_state, "unevaluated");
  assertEquals(evaluatorCorrelated.evaluator_results.length, 2);
});

Deno.test("requirement-level disagreement disputes even when statuses match", async () => {
  const second = structuredClone(qualified(evaluatorB)) as unknown as {
    requirements: Array<{
      id: string;
      satisfied: boolean;
      candidate_span: [number, number] | null;
      evidence_ids: string[];
    }>;
  } & Record<string, unknown>;
  second.requirements[1] = {
    id: "R2",
    satisfied: false,
    candidate_span: null,
    evidence_ids: [],
  };
  second.status = "non_answer";

  const first = structuredClone(qualified(evaluatorA)) as Record<
    string,
    unknown
  >;
  first.status = "non_answer";
  const firstRequirements = first.requirements as Array<
    Record<string, unknown>
  >;
  firstRequirements[0] = {
    id: "R1",
    satisfied: false,
    candidate_span: null,
    evidence_ids: [],
  };

  const result = await resolve([first, second]);
  assertEquals(result.evaluation_state, "disputed");
  assertEquals(result.evaluation_reason, "valid_independent_disagreement");
  assertEquals(result.qualification, null);
  assertEquals(result.simulation_result, "NO_QUALIFIED_ANSWER");
});

Deno.test("matching non-answer records remain advisory and non-qualifying", async () => {
  const nonAnswer = (evaluator: ShadowEvaluatorIdentity) => {
    const value = structuredClone(qualified(evaluator)) as Record<
      string,
      unknown
    >;
    value.status = "non_answer";
    const requirements = value.requirements as Array<Record<string, unknown>>;
    requirements[1] = {
      id: "R2",
      satisfied: false,
      candidate_span: null,
      evidence_ids: [],
    };
    return value;
  };
  const result = await resolve([nonAnswer(evaluatorA), nonAnswer(evaluatorB)]);
  assertEquals(result.evaluation_state, "evaluated");
  assertEquals(result.shadow_disposition, "offline_match_non_qualified");
  assertEquals(result.simulation_result, "NO_QUALIFIED_ANSWER");
});

Deno.test("requirement span disagreement cannot mint false offline agreement", async () => {
  const shiftedSpan = structuredClone(qualified(evaluatorB)) as Record<
    string,
    unknown
  >;
  const requirements = shiftedSpan.requirements as Array<
    Record<string, unknown>
  >;
  requirements[0].candidate_span = span("Evidence E2 confirms the check.");

  const result = await resolve([qualified(evaluatorA), shiftedSpan]);
  assertEquals(result.evaluation_state, "disputed");
  assertEquals(result.shadow_disposition, "offline_disputed");
});

Deno.test("candidate hash mismatch fails closed with a structured reason", async () => {
  const wrongCandidate = structuredClone(qualified(evaluatorA)) as Record<
    string,
    unknown
  >;
  wrongCandidate.candidate_sha256 = `sha256:${"f".repeat(64)}`;

  const result = await resolve([wrongCandidate, qualified(evaluatorB)]);
  assertEquals(result.evaluation_state, "unevaluated");
  assertEquals(result.evaluation_reasons, [
    "candidate_binding_mismatch",
    "insufficient_valid_independent_results",
  ]);
  assertEquals(result.evaluator_results.length, 1);
});

Deno.test("contract hash mismatch fails closed with a structured reason", async () => {
  const wrongContract = structuredClone(qualified(evaluatorA)) as Record<
    string,
    unknown
  >;
  wrongContract.task_id_hash = `sha256:${"e".repeat(64)}`;

  const result = await resolve([wrongContract, qualified(evaluatorB)]);
  assertEquals(result.evaluation_reasons, [
    "contract_binding_mismatch",
    "insufficient_valid_independent_results",
  ]);
});

Deno.test("malformed outputs become unavailable instead of acquiring authority", async () => {
  const unknownEvidence = structuredClone(qualified(evaluatorA)) as Record<
    string,
    unknown
  >;
  const requirements = unknownEvidence.requirements as Array<
    Record<string, unknown>
  >;
  requirements[0].evidence_ids = ["E999"];

  const wrongCount = structuredClone(qualified(evaluatorB)) as Record<
    string,
    unknown
  >;
  wrongCount.unsupported_claim_count = 1;

  const result = await resolve([unknownEvidence, wrongCount]);
  assertEquals(result.evaluation_state, "unevaluated");
  assertEquals(result.evaluator_results, []);
});

Deno.test("invalid spans and unknown statuses fail closed", async () => {
  const invalidSpan = structuredClone(qualified(evaluatorA)) as Record<
    string,
    unknown
  >;
  const requirements = invalidSpan.requirements as Array<
    Record<string, unknown>
  >;
  requirements[0].candidate_span = [0, candidate.length + 1];

  const unknownStatus = structuredClone(qualified(evaluatorB)) as Record<
    string,
    unknown
  >;
  unknownStatus.status = "banana";

  assertEquals(
    (await resolve([invalidSpan, unknownStatus])).evaluation_state,
    "unevaluated",
  );
});

Deno.test("resolver bounds evaluator count and validates the contract before resolving", async () => {
  await assertRejects(
    () =>
      resolve([
        qualified(evaluatorA),
        qualified(evaluatorB),
        qualified(evaluatorA),
      ]),
    Error,
    "expected at most two",
  );

  const invalidContract = {
    ...contract,
    second_evaluator_confidence_below: 2,
  } as ShadowTaskContract;
  await assertRejects(
    () =>
      resolveGroundedShadowEvaluations({
        contract: invalidContract,
        candidate,
        candidate_source: candidateSource,
        evaluator_results: [],
      }),
    Error,
    "must be in [0,1]",
  );

  const staleContractHash = {
    ...contract,
    task_type: "changed_after_hash",
  } as ShadowTaskContract;
  await assertRejects(
    () =>
      resolveGroundedShadowEvaluations({
        contract: staleContractHash,
        candidate,
        candidate_source: candidateSource,
        evaluator_results: [],
      }),
    Error,
    "does not match canonical contract JSON",
  );

  const malformedNested = {
    ...contract,
    requirements: [null],
  } as unknown as ShadowTaskContract;
  await assertRejects(
    () =>
      resolveGroundedShadowEvaluations({
        contract: malformedNested,
        candidate,
        candidate_source: candidateSource,
        evaluator_results: [],
      }),
    Error,
    "contract.requirements[0]: expected object",
  );

  const unknownContractKey = {
    ...contract,
    routing_authority: true,
  } as unknown as ShadowTaskContract;
  await assertRejects(
    () =>
      resolveGroundedShadowEvaluations({
        contract: unknownContractKey,
        candidate,
        candidate_source: candidateSource,
        evaluator_results: [],
      }),
    Error,
    "expected keys",
  );
});

Deno.test("offline resolver is not imported by production routing", async () => {
  const router = await Deno.readTextFile(
    new URL("../../router.ts", import.meta.url),
  );
  assertEquals(router.includes("grounded_shadow"), false);
  assertEquals(router.includes("resolveGroundedShadowEvaluations"), false);
});
