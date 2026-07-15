# Ensemble quality measurements

`aggregateEnsembleQuality()` is a pure, measurement-only API for panels whose
outcomes were evaluated outside QuorumRouter. It summarizes four advisory
signals: co-failure, selection regret, minority reports, and observable
(real-diversity) proxies. The report has no routing, eligibility, invocation, or
synthesis authority.

```ts
import { aggregateEnsembleQuality } from "../router.ts";

const report = aggregateEnsembleQuality(observations);
console.log(report.advisory_only); // true
```

## Truth boundary

Every observation must declare
`evaluation_basis: "caller_attested_external_ground_truth"`. This is an
attestation, not proof. The caller remains responsible for evaluator quality,
label independence, task/invocation binding, replay protection, and canonical
provider/model identity. QuorumRouter does not infer correctness from agreement
or from which source was selected.

All observations in one aggregate call must contain the same task type and the
same unordered panel of 2–16 unique provider/model sources. The report preserves
the evaluation basis and task type, and normalizes the minimum/maximum
evaluation timestamps into `evaluation_window`, so callers do not silently
combine unlike buckets or lose the measurement interval. Observation IDs are
unique, task and conclusion IDs are bounded lowercase canonical identifiers,
timestamps are RFC 3339, and no more than 10,000 observations are accepted.

## Privacy boundary

The strict input schemas accept IDs and bounded numeric measurements only. They
reject prompts, responses, credentials, notes, and other unknown/free-form
fields. `evidence_ids` are identifiers, not evidence content. Optional
`observable_reasoning_embedding` values are externally supplied vectors; raw
reasoning or chain-of-thought is neither accepted nor returned. Embeddings are
finite, non-zero, at most 256 dimensions, and must have one consistent dimension
within each observation. Aggregate calls additionally cap evidence-ID references
and embedding scalar values at 1,000,000 each, preventing the 10,000-observation
limit from becoming an unbounded nested payload.

## Formulas and null semantics

### Co-failure matrix

For source `A`, accuracy is `correct_A / N`. For each pair `(A, B)`:

- pairwise co-failure is `count(!A && !B) / N`;
- outcome disagreement is `count(correct_A != correct_B) / N`, a held-out
  complementarity signal;
- conditional success is `count(A && !B) / count(!B)` (and the inverse);
- a conditional value is `null` when its failure denominator is zero.

`all_model_cofailure_beta.observed_rate` is the direct empirical estimate
`all_failed_count / sample_count`. It is not inferred from pairwise correlation
and is not a smoothed posterior. For a policy restricted to returning one panel
answer, `1 - beta` is the empirical oracle ceiling on that dataset. It is not a
ceiling for synthesis that creates a new answer.

### Selection regret

`oracle_success_rate` is the fraction of observations where any candidate was
externally correct. `selected_success_rate` uses all observations as the
denominator; a null selection is not selected and not correct.
`selection_regret = oracle_success_rate - selected_success_rate`.
`selection_success_given_oracle` is `null` when there are no oracle-success
observations. `best_single_success_rate` is the best fixed source on the same
panel; ties are retained in `best_single_sources`. The held-out complementarity
headroom is `oracle_uplift = oracle_success_rate - best_single_success_rate`.
`captured_uplift` and `capture_rate` show how much of that headroom the recorded
selection realized. `capture_rate` is `null` when oracle uplift is zero.

### Minority reports

A majority exists only when one conclusion has strictly more than 50% of panel
votes. Ties therefore have `majority_answer: null`. Dissenting conclusion and
evidence IDs are retained, including externally correct minority candidates.
`majority_overturn_triggered` means the selected source belongs to a minority
when a strict majority exists. `unresolved_disagreement` lists sorted unique
conclusion IDs whenever more than one conclusion remains.

### Observable diversity

- Conclusion diversity is Gini–Simpson `1 - Σ p_i²`, normalized by the maximum
  `1 - 1/N` for the panel size.
- Evidence diversity is the mean pairwise Jaccard distance over evidence-ID
  sets. Two empty sets have distance zero.
- Observable reasoning similarity is mean pairwise cosine similarity among
  candidates that supplied compatible embeddings; it is `null` when fewer than
  two are available.
- Effective rank is `exp(-Σ q_i log q_i)`, where `q_i` are singular values
  normalized by their sum. The implementation derives singular values as square
  roots of positive cosine-Gram eigenvalues, using a deterministic bounded
  Jacobi solver. Identical vectors approach rank 1; mutually orthogonal vectors
  approach the embedded candidate count.
- `effective_vote_count` equals effective rank when available. Otherwise its
  explicitly named fallback is `observable_signature_count`, the number of
  distinct `(conclusion_id, sorted evidence_ids)` signatures.

Missing optional expertise scores are returned as `null`. A supplied
`task_expertise_score` must come from the caller's external historical
evaluation; it is not model self-confidence. Null means unknown or an undefined
denominator; it never means zero. These representation metrics are proxies, not
proof of useful diversity or independent errors. Held-out `oracle_uplift`,
outcome disagreement, and co-failure remain the primary outcome signals; encoder
identity and version must be governed by the caller.

## No routing authority

Calling this function does not invoke a model and is not wired into candidate
selection, provider eligibility, routing weights, quorum, debate, or synthesis.
Its intended staged sequence is:

1. independent proposals;
2. measurement against external ground truth;
3. selective debate, if a separate caller explicitly chooses it;
4. aggregation.

Measurements may inform human analysis or a separately governed future policy,
but this API itself cannot alter runtime behavior.
