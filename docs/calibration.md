# Calibration by task type

QuorumRouter exposes a pure, additive API for summarizing externally evaluated
confidence observations by explicit `task_type` and provider/model source.
Calibration reports are advisory diagnostics only. The router does not consume
them and they carry no routing or execution authority.

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

This pure aggregation API performs no evaluator authentication, policy-version
verification, invocation binding, durable replay protection, or cross-call
deduplication. Callers that need those guarantees must establish them before
calling this function. `observation_id` uniqueness is enforced only within one
call. Callers must also provide canonical task taxonomy and immutable model
revision identifiers when results must remain comparable; NFC normalization does
not resolve aliases or Unicode confusables.

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
