# Research foundations for ensemble quality

QuorumRouter treats multi-model orchestration as a measurement and selection
problem, not as an assumption that more agents or majority voting are inherently
better. The first implementation wave is advisory-only: it measures externally
evaluated panel outcomes and does not change provider selection, quorum,
routing, or synthesis.

## Evidence status

The sources below are public arXiv papers or preprints. Several are recent
preprints and should not be treated as replicated or peer-reviewed merely
because QuorumRouter cites them. QuorumRouter adopts transparent metric
definitions that can be tested independently; it does not claim to reproduce
each paper's experimental results.

| Source                                                                                                                               | Identifier and publication status                                                                                                                                      | Design signal                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| _When Does Combining Language Models Help? A Co-Failure Ceiling on Routing, Voting, and Mixture-of-Agents Across 67 Frontier Models_ | [arXiv:2606.27288v1](https://arxiv.org/abs/2606.27288); recent single-author preprint                                                                                  | Measure the all-model co-failure rate `beta`; pairwise correlation alone does not identify the all-wrong tail.        |
| _When Agents Disagree: The Selection Bottleneck in Multi-Agent LLM Pipelines_                                                        | [DOI:10.3390/app16104914](https://doi.org/10.3390/app16104914); earlier [arXiv:2603.20324v1](https://arxiv.org/abs/2603.20324)                                         | Measure whether an aggregator selects an available correct candidate before adding more generators.                   |
| _Minority Sentinel: When to Overturn Majority Voting in Multi-Agent LLM Debates_                                                     | [arXiv:2606.29270v1](https://arxiv.org/abs/2606.29270); recent preprint reporting AgentSearch @ SIGIR 2026 acceptance                                                  | Preserve minority evidence and evaluate overturn precision instead of assuming the majority is correct.               |
| _Representational Collapse in Multi-Agent LLM Committees: Measurement and Diversity-Aware Consensus_                                 | [arXiv:2604.03809v1](https://arxiv.org/abs/2604.03809); recent single-author preprint with no public code identified                                                   | Measure observable output similarity and effective rank; role labels alone are not evidence of independent reasoning. |
| _RouteLLM: Learning to Route LLMs with Preference Data_                                                                              | [arXiv:2406.18665v4](https://arxiv.org/abs/2406.18665); ICLR 2025                                                                                                      | Learn quality/cost routing from preference evidence rather than static model reputation.                              |
| _RouterBench: A Benchmark for Multi-LLM Routing System_                                                                              | [arXiv:2403.12031v2](https://arxiv.org/abs/2403.12031)                                                                                                                 | Evaluate routers against standardized model outcomes and cost trade-offs.                                             |
| _LLMRouterBench: A Massive Benchmark and Unified Framework for LLM Routing_                                                          | [Findings of ACL 2026](https://aclanthology.org/2026.findings-acl.1881/), [DOI:10.18653/v1/2026.findings-acl.1881](https://doi.org/10.18653/v1/2026.findings-acl.1881) | Track oracle gaps, diminishing returns, and quality-cost-latency trade-offs under a unified evaluation.               |

## Adopted measurement definitions

Given externally evaluated binary correctness labels for a fixed model panel:

- `all_model_cofailure_beta` is the fraction of observations for which every
  panel member is incorrect. For a policy restricted to returning one member
  answer, `1 - beta` is the empirical oracle ceiling on that panel and dataset.
- `oracle_success_rate` is the fraction of observations containing at least one
  correct candidate.
- `selected_success_rate` is the fraction for which the recorded selected source
  is correct. Abstention or no selection is not counted as a correct selection.
- `selection_success_given_oracle` is the conditional success rate among
  observations where a correct candidate exists.
- `selection_regret` is `oracle_success_rate - selected_success_rate`. It is an
  operational diagnostic, not a causal attribution to the Judge.
- `best_single_success_rate` is the highest fixed source accuracy on the same
  held-out panel. `oracle_uplift` is
  `oracle_success_rate -
  best_single_success_rate`; this outcome uplift,
  rather than provider count, role labels, or embedding distance alone, is the
  primary evidence that the panel has useful complementarity.
- `captured_uplift` is `selected_success_rate - best_single_success_rate` and
  `capture_rate` is `captured_uplift / oracle_uplift` when oracle uplift is
  nonzero.

A minority report records a strict majority only when one conclusion has more
than half of the panel. Ties have no majority. The report preserves minority
conclusions and evidence identifiers, but it does not automatically authorize an
overturn. Correctness still comes only from the caller-attested external label.

For observable reasoning embeddings, effective rank follows the entropy of the
singular-value spectrum:

```text
p_j = sigma_j / sum(sigma)
effective_rank = exp(-sum(p_j * log(p_j)))
```

The metric ranges from approximately `1` for identical vectors to the panel size
for orthogonal vectors. It is only a representation proxy, not proof of
statistical independence or useful complementarity. Encoder choice is part of
the measurement contract and can materially change the result; the encoder and
version must therefore be fixed outside this content-free aggregation API and
validated against held-out oracle uplift, rescue rate, selection regret, and
co-failure. QuorumRouter accepts only caller-computed observable embeddings; it
does not request, infer, or persist hidden chain-of-thought.

## Protocol boundary

The intended sequence is:

```text
independent proposals
  -> ensemble quality measurement
  -> selective debate when new evidence is possible
  -> blinded aggregation or selection
  -> answer, abstain, tool verification, or human escalation
```

The measurement API is intentionally separate from routing authority. Promoting
these diagnostics into automated set routing, majority overturns, or stop rules
requires a later policy layer with explicit calibration and fail-closed gates.
