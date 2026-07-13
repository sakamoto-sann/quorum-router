# Decision reports

QuorumRouter exposes machine-readable evidence for why a direct route completed
or stopped. Decision reports do not claim that a semantic majority agreed.

## Direct routing

Use the additive detailed API when the caller needs routing evidence:

```ts
const { final, decision_report } = await router.routeWithDecisionReport(prompt);

console.log(final.synthesis);
console.log(decision_report.outcome);
console.log(decision_report.quorum);
console.log(decision_report.failures);
```

The existing `router.route(prompt)` API remains unchanged and returns only
`FinalSynthesis`.

A direct route follows this sequence:

```text
Invoke → validate adapter outputs → check the minimum valid-output threshold → synthesize or stop
```

The direct-route threshold is a count of valid adapter outputs. It is not a
semantic majority vote and does not prove that the candidates agree.

Every report includes both:

- `configured_required`: the configured minimum
- `effective_required`: the minimum after direct-routing policy selection

This distinction matters because policy selection can reduce the executable
candidate set.

Successful direct routing reports `minimum_valid_outputs_synthesized`.
Fail-closed errors continue to throw `RouterError`; their sanitized
`details.decisionReport` distinguishes:

- `no_executable_adapters`
- `insufficient_valid_outputs`
- `synthesis_failed`

Adapter failures remain separate entries in `failures[]` with stage, provider,
model, and code. They are not collapsed into a misleading single
transport-versus-validation outcome. Reports omit prompts, credentials, and raw
candidate content.

## Structured Fusion

`runStructuredFusion()` returns a separate `decision_report` containing the
validated Structured Judge evidence:

- agreements
- recorded disagreements and positions
- strengths
- rejected claims and reasons
- uncertainties
- additional checks

Its outcome is one of:

- `structured_synthesis_with_recorded_disagreement`
- `structured_synthesis_without_recorded_disagreement`

"Recorded disagreement" means only that the Structured Judge produced one or
more validated disagreement records. It does not mean that QuorumRouter proved a
majority/minority split, identified a correct winner, or established that a
provider is systematically weak.

Candidate and Judge source labels must be unique and must refer to the actual
candidate set. Unknown or duplicate sources fail closed before their evidence is
accepted.

## Reliability analysis boundary

Decision reports describe one run. They are not correctness labels and cannot be
submitted to task calibration. Consensus, majority/minority position, recorded
disagreement, synthesis choice, and routing outcome never establish ground
truth. A response must not be treated as correct or incorrect without an
external evaluation.

The separate [calibration API](calibration.md) aggregates only explicit,
externally evaluated observations. Its metrics by task, hierarchy, and source
are advisory diagnostics: they do not change routing weights, ranks,
eligibility, or execution behavior. When hierarchy input is supplied, the
per-run report records the requested scope, each inspected pattern/subtype/task
candidate, and the first sufficient fallback without treating that aggregate as
ground truth. The caller-attested-ground-truth marker is an unverified
provenance assertion, not proof supplied by QuorumRouter.
