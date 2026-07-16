# Grounded non-answer shadow evaluator proposal

Status: Phase 0 contract tooling, a Phase 1 offline resolver, and a standalone
Phase 2 experimental shadow runner. The runner can invoke up to two explicitly
bound model adapters only after config enablement, experimental enablement,
per-request opt-in, a clear kill switch, frozen-selection validation, identity
distinctness checks, and pre-invocation budget checks. Neither runtime module is
imported by the production router or compatibility barrel. These tools do not
enter the production route. They do not change routing behavior.

## Decision summary

- Measure qualification after the existing route is fixed. Phase 1 and Phase 2
  are post-selection measurement only; qualification before scalar ranking is
  reserved for a separately reviewed future authority proposal.
- Classify every candidate as `qualified`, `abstained`, `non_answer`, or
  `invalid` against a bounded caller-supplied task contract.
- Ground every satisfied requirement in a bounded candidate span and known
  evidence identifiers.
- Preserve the existing selected route during shadow evaluation. The shadow
  result has no routing, quorum, synthesis, execution, or approval authority.
- Use independent evaluator identities and selective second evaluation; do not
  use all-provider majority voting.

## Evidence from v0.1.19 dogfood

The v0.1.19 targeted post-release run verified both patch regressions in their
public distribution surfaces. Three forced real-provider Task C lanes returned
usable reviews, but Codex, Grok, and Devin each received the same heuristic
score: 17/17. The same public scorer also gave 17/17 to a synthetic non-answer
that requested evidence already present in the prompt.

A real bounded Best Route rerun retained Grok while Codex returned no usable
answer and Devin encountered a temporary provider-capacity failure. Failed
providers remained visible and no silent fallback occurred. Gemini was not
invoked.

This evidence narrows the problem: output length, schema validity, and broad
surface heuristics do not establish that a requested deliverable was completed.
The secret-free command/result readback is recorded in
[the v0.1.19 targeted dogfood report](dogfood-v0.1.19-targeted.md).

## Threat model

The design must detect at least these candidate failures:

1. restating the request without completing it;
2. requesting evidence the caller already supplied;
3. claiming verification or an external action without a receipt;
4. satisfying only a subset of required deliverables;
5. fabricating evidence identifiers;
6. abstaining for a reason outside the allowed bounded reasons;
7. presenting polished prose that receives a high heuristic score but is not an
   answer.

The design does not attempt to infer hidden chain of thought or semantic truth
without caller-attested labels.

## Bounded task contract

The caller compiles or supplies a strict contract before candidate invocation:

```ts
type ShadowTaskContract = {
  schema_version: "quorum-router.shadow.contract.v1";
  task_id_hash: string;
  task_type: string;
  requirements: Array<{
    id: string;
    description: string;
    required: true;
    impact: "standard" | "high";
  }>;
  available_evidence: Array<{
    id: string;
    description: string;
  }>;
  allowed_abstention_reasons: string[];
  abstention_taxonomy_version: "quorum-router.abstention.v1";
  unsupported_claim_taxonomy_version: "quorum-router.unsupported-claim.v1";
  prohibited_claim_types: Array<
    | "external_action_without_receipt"
    | "verification_without_evidence"
    | "fabricated_evidence_identifier"
  >;
  second_evaluator_confidence_below: number;
};
```

`task_id_hash` binds the SHA-256 digest of canonical UTF-8 JSON containing
`task_type`, requirements, available evidence, allowed abstention reasons,
abstention taxonomy version, unsupported-claim taxonomy version, prohibited
claim types, and the second-evaluator threshold; the digest field itself is
excluded. The Phase 1 resolver recomputes this digest before accepting evaluator
records. Canonicalization uses the member order listed above, preserves array
order, omits whitespace, and applies ECMAScript `JSON.stringify` encoding to the
validated values. Phase 0 fixture hashes are redacted placeholders and are
checked for shape only, so the fixture corpus makes no integrity claim for them.

Bounds for a future implementation must be explicit for total requirements,
evidence identifiers, label lengths, candidate bytes, and evaluator output. The
contract contains labels, descriptions, and hashes only: no credentials, hidden
reasoning, unrestricted session state, or raw private configuration.

## Qualification record

A shadow evaluator returns a strict record:

```ts
type ShadowQualification = {
  schema_version: "quorum-router.shadow-qualification.v1";
  advisory_only: true;
  candidate_sha256: `sha256:${string}`; // exact frozen UTF-16 code units
  task_id_hash: `sha256:${string}`; // exact frozen task contract identity
  status: "qualified" | "abstained" | "non_answer" | "invalid";
  requirements: Array<{
    id: string;
    satisfied: boolean;
    candidate_span: [number, number] | null;
    evidence_ids: string[];
  }>;
  asks_for_available_evidence: boolean;
  unsupported_claims: Array<{
    claim_type: string;
    candidate_span: [number, number];
  }>;
  unsupported_claim_count: number; // derived from unsupported_claims.length
  abstention_reason: string | null;
  confidence: number;
  evaluator: ShadowEvaluatorIdentity;
};

type ShadowEvaluationEnvelope = {
  schema_version: "quorum-router.shadow-evaluation-envelope.v1";
  advisory_only: true;
  evaluation_state: "evaluated" | "unevaluated" | "disputed";
  evaluation_reason:
    | "completed"
    | "no_independent_evaluator"
    | "insufficient_valid_independent_results"
    | "valid_independent_disagreement";
  evaluation_reasons: Array<
    | "no_evaluator_result"
    | "malformed_evaluator_output"
    | "candidate_binding_mismatch"
    | "contract_binding_mismatch"
    | "candidate_identity_collision"
    | "pairwise_identity_collision"
    | "insufficient_valid_independent_results"
  >;
  qualification: ShadowQualification | null;
  evaluator_results: ShadowQualification[]; // bounded to at most two
  shadow_disposition:
    | "offline_match_qualified"
    | "offline_match_non_qualified"
    | "offline_unavailable"
    | "offline_disputed";
  simulation_result: "QUALIFIED_CANDIDATES_PRESENT" | "NO_QUALIFIED_ANSWER";
  selection_changed: false;
};
```

Every record's `task_id_hash` must equal the frozen contract identity, and its
`candidate_sha256` must equal the SHA-256 digest of the frozen candidate's exact
UTF-16 code units encoded little-endian. Every span must be inside that same
observable candidate answer. Every evidence ID must exist in the task contract.
Span offsets are zero-based, half-open `[start, end)` indices into the exact,
unnormalized ECMAScript UTF-16 string value supplied as the candidate: no
Unicode, newline, or whitespace normalization is permitted between evaluation
and validation. Inverted, out-of-range, clamped, byte-indexed, or
code-point-indexed spans are invalid and fail closed. The record stores no chain
of thought.

```ts
type ShadowEvaluatorIdentity = {
  principal_type: "model";
  provider_id: string;
  model_id: string;
  model_revision: string;
  operator_domain: string;
  evaluator_config_hash: `sha256:${string}`;
};
```

For this proposal, an evaluator is identity-distinct only when both its
canonical `provider_id` and `operator_domain` differ from the candidate's.
Different model names, revisions, prompts, or config hashes under the same
provider or operator do not establish identity distinctness. The canonical
independence predicate is only a syntactic anti-collision check; it does not
authenticate an evaluator or establish epistemic independence. Unknown, missing,
aliased, or unverified identity data fail closed to `unevaluated`; caller
renaming does not create independence.

## Status semantics

### `qualified`

All required deliverables map to non-empty candidate spans, all cited evidence
identifiers exist, and no unsupported action or verification claim is present.
`qualified` is valid if and only if every required deliverable is satisfied. A
partial answer cannot be `qualified`.

### `abstained`

The answer explicitly identifies a missing prerequisite and that prerequisite is
one of the contract's allowed abstention reasons. An abstention cannot claim
that already-available evidence is missing.

### `non_answer`

The answer restates the request, asks for already-available evidence, or fails
to map one or more required deliverables despite otherwise valid output.

### `invalid`

The candidate or evaluator record fails strict schema, bounds, span, evidence,
or unsupported-action checks. Any structured prohibited-claim hit makes the
candidate `invalid`; it cannot remain qualified through a high surface score.

## Evaluation sequence

1. Validate the task contract before provider invocation.
2. Preserve the existing candidate panel and freeze the existing selected
   candidate identifier as input.
3. Evaluate every observable candidate answer against the same contract. Shadow
   output cannot reorder the panel or replace the frozen selection.
4. Run deterministic structural checks on spans, identifiers, bounds, and
   impossible claims.
5. Apply the canonical independence predicate above. If no independent evaluator
   is available, emit an `unevaluated` shadow event rather than self-evaluating.
6. Request at most one second evaluator when confidence is below the contract's
   bounded threshold, a requirement is marked high impact, or the first result
   contains an unsupported-claim category. Disagreement is the total function
   defined below; narrative prose is diagnostic and never part of its equality
   predicate.
7. Record both evaluator results and disagreement; do not collapse correlated
   judges into a simple majority. A dual-evaluator result is shadow-qualifying
   only when both evaluators return compatible `qualified` requirement results.
   Every other disagreement emits a `disputed` envelope and is non-qualifying
   for offline simulation. Fewer than two schema-valid, pairwise-independent
   results fail closed to `unevaluated` with
   `insufficient_valid_independent_results`; one result is never agreement.
8. Emit shadow telemetry after the original route result is fixed. Shadow output
   cannot veto, rerank, execute, approve, or mutate.

`dispute(a, b)` is a closed, deterministic comparison over structured fields
only. First reject either result unless its status, reason, taxonomy versions,
claim tuples, requirement IDs, evidence IDs, bounds, and identity are valid.
Then canonicalize each result as:

- the status enum;
- the taxonomy-approved abstention reason or `null`;
- an order-insensitive, duplicate-free sorted set of
  `(claim_type, exact_candidate_span)` tuples;
- an order-insensitive, duplicate-free sorted set of
  `(requirement_id, satisfied, exact_candidate_span_or_null,
  sorted_unique_evidence_ids)`
  tuples that covers every contract requirement exactly once.

The result is `agreed` iff the canonical records are byte-identical JSON;
otherwise it is `disputed`. Free-text explanations are excluded. Unknown claim
or abstention taxonomy values, cross-version comparisons, duplicate tuples,
unknown IDs, invalid spans, non-enum statuses, and non-independent evaluator
pairs fail closed before comparison.

For offline qualified-only simulation, zero qualified candidates produce the
explicit `simulation_result` value `NO_QUALIFIED_ANSWER`; this is not a fifth
candidate status and must never be written to live routing fields. The
simulation must not promote an abstained, non-answer, invalid, unevaluated, or
disputed candidate.

A future authority-changing proposal must be separate and must not reuse shadow
telemetry as an implicit permission grant.

## Independence and judge-bias controls

- An evaluator must satisfy the canonical provider-and-operator independence
  predicate; same-provider or same-operator comparisons are not independent.
- The complete canonical evaluator identity is part of the observable record.
- Measure disagreement by candidate/evaluator pair and by task type.
- Preserve minority-qualified candidates rather than treating popularity as
  correctness.
- Maintain a caller-labeled audit sample for false-positive and false-negative
  analysis.
- Agreement is not proof of truth. Correlated evaluators can agree incorrectly;
  `evaluated` and `qualified` remain measurements against caller labels, not
  factual authority.
- Gemini is not a dependency. The contract is provider-neutral.

## Shadow telemetry

Record only bounded metadata:

- hashed task and candidate identifiers;
- candidate provider/model identity;
- evaluator provider/model identity;
- qualification status and confidence;
- requirement coverage counts;
- known evidence identifier counts;
- `asks_for_available_evidence`;
- unsupported-claim count;
- evaluator disagreement;
- existing selected source and whether it was shadow-qualified;
- incremental latency and caller-supplied cost estimates.

Do not record raw prompts, unrestricted candidate text, credentials, cookies,
session material, private config, or hidden reasoning in aggregate telemetry.

## Measurement plan

Primary metrics:

- non-answer recall;
- qualified-answer false rejection rate;
- abstention precision and recall;
- invalid-record detection rate;
- requirement-coverage calibration;
- evaluator disagreement by provider/model pair;
- selected-answer shadow qualification rate;
- selection regret before and after an offline qualified-only simulation;
- minority-qualified preservation;
- incremental latency and estimated cost.

The checked-in corpus is a small provisional contract fixture, not a quality
benchmark, calibration set, training set, or gold measurement set. Its 10..100
case bound applies only to the Phase 0 schema fixture; larger evaluation corpora
require a separately versioned schema and review. Before any authority
discussion, evaluate a preregistered, independently adjudicated caller-labeled
corpus with direct answers, justified abstentions, restatements, requests for
supplied evidence, fabricated verification, partial answers, and valid minority
answers. Report confidence intervals and slice results; do not rely on an
aggregate score alone.

## Rollout gates

### Phase 0: contract fixture

- strict corpus shape and status semantics;
- no provider calls;
- no runtime imports;
- no routing effect;
- exact expected state, status, and disposition for every labeled case.

### Phase 1: offline evaluator experiment

- evaluator output validated against a separate, independently adjudicated
  corpus that was not used for evaluator training or prompt tuning;
- deterministic structural checks run before judge interpretation;
- judge disagreement and bias reported.

### Phase 2: real-run shadow mode

- existing selection is fixed before shadow evaluation;
- no blocking, reranking, quorum, synthesis, execution, or approval effect;
- bounded sampling, latency, and cost controls;
- explicit kill switch for shadow evaluation only.

The checked-in Phase 2 slice implements these gates as a standalone API. It is
not automatically called by any route method.

### Phase 3: separate authority review

Authority remains out of scope until caller-labeled evidence establishes
acceptable false-rejection, non-answer recall, abstention, latency, cost, and
judge-bias bounds. Any change must use a separate proposal, public API review,
security review, and release gate.

## Fixture corpus

`examples/grounded-non-answer-evaluator-corpus.json` is an illustrative labeled
contract fixture. It exists to freeze semantics and prevent the proposal from
becoming prose-only. It is not imported by `router.ts` and is not evidence of
model quality.

Every case is explicitly `caller_authored`, unadjudicated, and provisional. The
corpus policy prohibits training use and gold-measurement use. Amendments
require review and a versioned fixture change; passing this fixture certifies
only schema and cross-field consistency. In particular, fixture `qualified`
means the caller-supplied label record is complete and internally consistent,
not that the answer is factually grounded or that evidence semantically entails
a claim.

The fixture uses explicit requirement and evidence descriptions, caller-labeled
expected outcomes, exact human-readable candidate span text, evaluator
identities, versioned abstention reasons, and unsupported-claim inventories with
derived counts. A strict offline fixture validator checks the full runtime JSON
shape and cross-field semantics: qualified cases must cover every requirement
with a span present in the candidate and known evidence IDs; abstentions must
use a contract-approved reason; invalid cases must expose a structural
invalidity; independent-evaluator failure and evaluator disagreement must remain
non-qualifying. Mutation tests prove those contradictions are rejected. The
validator is not a semantic judge, does not infer truth, and does not claim
model-quality evidence.

This strict offline fixture validator is Phase 0 tooling only. It is not
imported by `router.ts`, makes no provider calls, and has no routing, scoring,
selection, quorum, synthesis, execution, or approval authority. Tests assert the
positive isolation invariant that neither `router.ts` nor the runtime
compatibility barrel imports the validator; Phase 0 is not on a runtime
dependency path.

## Implemented offline resolution boundary

`src/evaluation/grounded_shadow.ts` is a pure Phase 1 resolver. It accepts one
frozen candidate, its bounded task contract, its canonical source identity, and
at most two caller-supplied evaluator records. It validates exact schemas, the
candidate digest, UTF-16 spans, evidence references, taxonomy values, status
invariants, and the provider-and-operator identity-distinct predicate before
applying the canonical dispute function. Zero or one valid identity-distinct
result, malformed output, or a correlated evaluator pair returns `unevaluated`
with structured reason codes; disagreement returns `disputed`; only two
compatible valid identity-distinct records return `evaluated`.

The resolver itself does not call a model, choose evaluators, sample traffic, or
write telemetry. The separate Phase 2 runner below composes it without importing
into `router.ts` or modifying the existing score function or selection path.

## Implemented experimental shadow runtime boundary

`src/evaluation/grounded_shadow_runtime.ts` is a standalone provider-backed
runner. It accepts a caller-attested frozen-selection receipt, one frozen
candidate, its contract and source identity, and exactly two explicitly bound
evaluator adapters minted by `createGroundedShadowDirectEvaluatorAdapter()`.
Generic `ModelAdapter` and CLI/process adapters are rejected by a private
runtime brand. Candidate length and bounded array counts are checked before
snapshot construction. The runtime projects only known receipt, contract, and
identity fields, validates them with the Phase 1 parsers, then freezes bounded
copies before the first asynchronous preflight. It does not deep-clone unknown
caller fields, so oversized extras are discarded and later caller mutation
cannot swap adapters. The dedicated factory supports fixed OpenAI
chat-completions and Anthropic messages HTTP shapes, omits tool definitions,
applies a 4,096-token generation limit, requires the provider-reported model to
exactly match the configured model, makes exactly one `fetch` per invoked
evaluator, and has no retry, fallback, redirect, or synthesis path. It is
disabled unless `enabled` and `experimental` are both true and the individual
request sets `explicit_opt_in: true`. The independent `kill_switch` stops calls
before adapter invocation.

Before provider work, the runner rejects candidates above 16,000 UTF-16 code
units, then recomputes candidate and contract bindings inside the same global
deadline, requires the receipt to bind the selected candidate, checks adapter
descriptors against evaluator identities, applies candidate/evaluator and
pairwise identity distinctness checks, applies deterministic receipt-hash
sampling, and rejects work above the configured caller-supplied estimated-cost
or prompt-size ceiling. The estimated-cost ceiling is a pre-invocation bound
using the repository's USD comparison tolerance, not a claim about settled
provider billing. Preflight, provider calls, resolution, and optional sink
delivery share one bounded runtime deadline and separate `AbortSignal`
instances; timeout or caller cancellation returns a structured advisory failure.
The runner invokes at most two adapters, and each factory-minted adapter
performs one provider transport call.

The duration bound limits when the runner returns; even a dedicated `fetch`
transport cannot prove that a remote provider stopped work after cancellation. A
timeout therefore reports `provider_work_state: abort_signalled_unconfirmed`,
not completion. Callers must construct adapters only in trusted host
configuration; request data must never choose endpoints, credentials, protocols,
or test transport hooks. Provider work or billing may continue when a transport
or remote provider violates its `AbortSignal` contract.

The first evaluator runs before the optional second evaluator. The second is
invoked only for a high-impact requirement, confidence below the contract
threshold, an unsupported claim, an ask for already-available evidence, or an
unusable first record. A high-confidence standard-impact result therefore costs
one provider call and remains `unevaluated` rather than being promoted without
agreement.

The prompt includes a valid JSON qualification example and the complete
status-specific cross-field invariants. Evaluator output must be one strict JSON
record and is rejected before parsing when it exceeds `max_output_chars`. Its
complete declared evaluator identity must exactly match the prevalidated binding
identity. Raw model content and exception text are not copied into the result.
The existing Phase 1 resolver applies the contract, span, evidence, taxonomy,
and agreement checks. An injected sink is optional, receives a cloned result
plus an `AbortSignal`, and shares the runtime deadline. Sink failure is recorded
but cannot change the frozen selection or the returned evaluation result. As
with provider adapters, a sink that ignores its signal can continue its own work
after return, but it cannot mutate the returned result object.

The caller must invoke this API only after its production selection is final.
The selection receipt is a caller attestation bound to the exact candidate; the
runner does not claim to authenticate the caller's selection algorithm or its
wall-clock ordering. Evaluator identity fields and descriptor checks are
strictly validated syntactic anti-collision controls, not authentication.
Deterministic sampling is for load control and is caller-steerable; it is not a
security control. The API remains outside `router.ts`, has
`selection_changed: false` and `advisory_only: true` invariants, and has no
routing, ranking, quorum, synthesis, execution, or approval authority. Tests
assert zero adapter calls for every disabled, killed, non-opted-in, over-budget,
invalid-selection, invalid-config, invalid-binding-identity, and
identity-collision, unbranded-adapter, and malformed-sink gate.

## Non-goals

- No phrase blacklist for the observed Task C wording.
- No automatic or production-router shadow invocation.
- No production routing, scoring, rank, quorum, or synthesis changes.
- No automatic external action, repository mutation, or approval authority.
- No SafeLoop policy or receipt changes.
- No hidden chain-of-thought collection.
- No all-provider majority vote.
- No Gemini dependency or invocation.
- No v0.1.20 version bump or release action.
