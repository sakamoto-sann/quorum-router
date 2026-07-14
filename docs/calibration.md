# Calibration by task type

QuorumRouter exposes a strict aggregation API for summarizing externally
evaluated confidence observations by explicit `task_type` and provider/model
source. Direct routing can consume caller-supplied observations before provider
invocation and attach the resulting advisory report to its Decision Report.
Calibration never silently changes candidate eligibility, rank, quorum, budget,
or execution authority.

## Truth boundary

Every observation must declare
`evaluation_basis: "caller_attested_external_ground_truth"`. The caller is
responsible for supplying a correctness outcome produced by an evaluation
outside QuorumRouter. Never derive `correct` from a Decision Report, consensus,
a majority or minority position, disagreement, synthesis selection, or any other
router behavior.

The literal is an **unverified caller-supplied provenance assertion**.
QuorumRouter validates its shape but cannot establish that the evaluator is
independent, the label is reliable and matched to the right answer, or the
sample is free from label leakage, repetition, correlation, or selection bias.

`confidence` must be the model's probability, recorded **before the correctness
label is observed**, that the specific evaluated answer is correct. Evaluator
confidence, generic confidence about completing the task, or a score assigned
after seeing the label makes the Brier score and mean calibration bias
uninterpretable. The schema enforces only that the number is finite and within
`[0, 1]`; it cannot verify the score's timing or provenance.

The strict observation schema accepts only an ID, task type, provider/model
source, the caller-attested-ground-truth literal, binary correctness,
confidence, and evaluation timestamp. Prompts, responses, credentials, and
freeform content are not schema fields and are rejected. Identifiers are
trimmed, normalized to Unicode NFC, limited to 256 characters, and reject
control or Unicode default-ignorable characters. Timestamps require a valid RFC
3339 UTC offset.

The pure aggregation function performs no evaluator authentication,
policy-version verification, invocation binding, durable replay protection, or
cross-call deduplication. Callers that need those guarantees must establish them
before calling this function. `observation_id` uniqueness is enforced only
within one call. Callers must also provide canonical task taxonomy, including
stable subtype and prompt-pattern labels when using hierarchical calibration,
and immutable model revision identifiers when results must remain comparable;
NFC normalization does not resolve aliases or Unicode confusables. A
`prompt_pattern` is a caller-defined category such as `schema-boundary-review`,
never the raw prompt or an automatically generated embedding. Subtype and
pattern labels are limited to 128 lowercase ASCII characters: they must begin
and end with an alphanumeric character and may contain only lowercase
alphanumerics plus `._:/-`.

One call accepts at most 10,000 observations. `minimum_sample_count` must be a
positive integer no greater than that limit. Large datasets should be bounded
and partitioned by the caller before they enter an untrusted request path.

`evaluated_at` is the time the correctness label was established, not the model
invocation time.

## Example

```ts
import { aggregateTaskCalibration } from "../router.ts";

const report = aggregateTaskCalibration([
  {
    observation_id: "eval-001",
    task_type: "code_review",
    source: { provider: "OpenAI", model: "gpt-5" },
    evaluation_basis: "caller_attested_external_ground_truth",
    correct: true,
    confidence: 0.8,
    evaluated_at: "2026-07-13T00:00:00Z",
  },
  {
    observation_id: "eval-002",
    task_type: "code_review",
    source: { provider: "OpenAI", model: "gpt-5" },
    evaluation_basis: "caller_attested_external_ground_truth",
    correct: false,
    confidence: 0.6,
    evaluated_at: "2026-07-13T00:01:00Z",
  },
], { minimum_sample_count: 2 });
```

## Direct routing integration

```ts
const envelope = await router.routeWithDecisionReport("review this change", {
  calibration: {
    observations,
    options: { minimum_sample_count: 20 },
  },
});

console.log(envelope.decision_report.calibration);
```

The observations are validated and aggregated before any provider adapter is
invoked. Invalid or duplicate evidence fails closed. The report remains marked
`advisory_only: true` and is included on success and direct-routing failure
reports; it is not a hidden routing weight.

Generated NPX workspaces expose the same path for `route:once` and `best-route`:

```bash
deno task route:once --prompt "Review this change" \
  --calibration-evidence ./calibration-evidence.json
```

The local JSON file contains `{ "observations": [...], "options": {...} }`. The
generated CLI reads and validates it before provider discovery or invocation and
stores advisory metrics with SHA-256 task/source identifiers in the redacted
route trace. Raw task, provider, and model labels are not persisted there.

The example group has `sample_count: 2`, `accuracy: 0.5`,
`mean_confidence: 0.7`, `brier_score: 0.2`, and `mean_calibration_bias: 0.2`.
Metrics use:

- accuracy: mean of the binary correctness outcomes
- mean confidence: mean of the submitted confidence values
- Brier score: mean of `(confidence - outcome)²`
- mean calibration bias: `mean_confidence - accuracy` (positive is
  overconfidence)

`mean_calibration_bias` is a signed group-level average, not Expected
Calibration Error (ECE) and not a bucketed reliability estimate. Opposing local
overconfidence and underconfidence can cancel to zero; inspect it alongside the
Brier score rather than treating zero as proof of calibration.

Metric accumulation and report ordering are deterministic for the same set of
observations regardless of input order. The exported report schema also rejects
zero-sized groups, sample-status/threshold contradictions, and a signed mean
bias that does not equal `mean_confidence - accuracy`.

Groups below `minimum_sample_count` have `sample_status: "insufficient"`. The
minimum defaults to 20 and is only a reporting threshold; reaching it does not
make a group trusted or authorize automatic action. `"sufficient"` means only
`sample_count >= minimum_sample_count`; it does not establish statistical power,
independence, representativeness, validity, or routing fitness.

## Hierarchical calibration

The additive hierarchical API preserves the existing flat v1 API and groups the
same caller-attested observations at up to three scopes:

1. `task_type`
2. `task_subtype`
3. `prompt_pattern`

Generated workspaces include a deterministic walkthrough of all three selection
levels:

```bash
deno task calibration:hierarchy-demo
```

The command uses local fixture observations, makes no provider calls, and prints
one direct pattern selection followed by subtype and task fallback examples.

A pattern requires a subtype. Each observation contributes to its task group,
and to subtype and pattern groups only when those labels are present. Provider
and model remain part of every group key, so fallback never crosses a source
boundary.

```ts
const report = aggregateHierarchicalTaskCalibration(observations, {
  minimum_sample_count: 20,
});

const selection = resolveHierarchicalTaskCalibration(report, {
  task_type: "code_review",
  task_subtype: "typescript",
  prompt_pattern: "schema-boundary-review",
  source: { provider: "OpenAI", model: "gpt-5" },
});
```

Resolution inspects the requested pattern first, then its subtype, then the task
group. It selects the first group whose sample count meets the configured
threshold. `selection.candidates` records every inspected scope with `missing`,
`insufficient`, or `sufficient` status. If no scope is sufficient,
`resolution_status` is `no_sufficient_group` and no group is selected. The
resolver does not silently use an insufficient parent.

Attach the hierarchy to a per-run Decision Report with the additive route input:

```ts
const envelope = await router.routeWithDecisionReport(prompt, {
  hierarchicalCalibration: {
    observations,
    options: { minimum_sample_count: 20 },
    query: {
      task_type: "code_review",
      task_subtype: "typescript",
      prompt_pattern: "schema-boundary-review",
      source: { provider: "OpenAI", model: "gpt-5" },
    },
  },
});

console.log(envelope.decision_report.hierarchical_calibration?.selection);
```

Aggregation and resolution complete before provider invocation. Invalid labels,
duplicate observation IDs, contradictory report fields, or a selection that does
not match its aggregate report fail closed. Flat `calibration` and
`hierarchicalCalibration` inputs are mutually exclusive so one run cannot attach
conflicting evidence sets. The attached hierarchy remains `advisory_only: true`;
candidate eligibility, rank, weight, quorum, budget, and execution are
unchanged.

### Optional child-versus-parent drift guard

Sample-count fallback does not detect a caller assigning an observation to the
wrong canonical label. Callers that want an outcome-level guard can opt into a
separate, additive resolver:

```ts
const selection = resolveHierarchicalTaskCalibrationWithDriftGuard(
  report,
  {
    task_type: "code_review",
    task_subtype: "typescript",
    prompt_pattern: "schema-boundary-review",
    source: { provider: "OpenAI", model: "gpt-5" },
  },
  { maximum_child_parent_brier_score_delta: 0.1 },
);
```

For each sufficiently sampled child, the guarded resolver compares its Brier
score with the immediate sufficiently sampled parent for the same exact
task/provider/model identity. A child whose score is worse by more than the
caller-specified threshold is marked `quarantined` and selection continues at
the parent. Equality remains within threshold. If the immediate parent cannot be
validated, that child is `parent_unavailable` and is not selected. The guarded
selection carries `minimum_sample_count`, binds every candidate status to that
threshold, checks candidate bias and binary-outcome accuracy counts, and records
the parent scope and deterministic score delta. The guarded report additionally
rejects impossible child counts, fractional implied correct counts, and
weighted-metric roll-ups. Malformed guarded decisions and composed envelopes
return a normal `safeParse(...).success === false` result instead of throwing
from a nested refinement.

`DecisionReportSchema` and `DecisionReportEnvelopeSchema` remain the legacy
unguarded schemas so their inferred TypeScript outputs stay source-compatible.
Callers that explicitly accept guarded output can use `DecisionReportAnySchema`
and `DecisionReportEnvelopeAnySchema`, or the guarded-specific schemas/types.

A standalone guarded selection schema proves internal field consistency; it
cannot authenticate an independently supplied, coherently rewritten snapshot.
Validate `HierarchicalTaskCalibrationGuardedDecisionSchema` (or a composed any /
guarded envelope) to bind the selection exactly to its aggregate report. Even
that validation authenticates neither the caller nor the original observations;
evaluator trust and invocation binding remain application responsibilities.

This guard is opt-in and outcome-based. It does **not** inspect raw prompts or
prove that a label is semantically correct. Parent metrics include child
observations, so the comparison is not an independent statistical test. It can
miss a wrong label whose outcomes resemble its parent, and it can quarantine a
legitimate specialized bucket whose outcomes differ. It never renames or deletes
labels. The guarded result remains advisory-only and cannot change provider
eligibility, rank, weight, quorum, budget, routing, or execution.
