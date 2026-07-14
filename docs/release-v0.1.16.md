# QuorumRouter v0.1.16

> **Superseded for guarded-schema validation by v0.1.17.** Do not treat a
> standalone v0.1.16 guarded selection as authenticated or threshold-bound;
> regenerate persisted guarded selections from their reports with v0.1.17 or
> later.

QuorumRouter v0.1.16 adds an opt-in advisory child-versus-parent Brier drift
guard for hierarchical task calibration.

## Added

- `resolveHierarchicalTaskCalibrationWithDriftGuard()` with a caller-required
  finite `maximum_child_parent_brier_score_delta` in `[0, 1]`.
- Deterministic candidate audit rows for
  `prompt_pattern -> task_subtype ->
  task_type`, including metric snapshots,
  parent scope, Brier delta, and drift status.
- Guarded selection and combined guarded decision schemas under
  `quorum-router.hierarchical-guarded-selection.v1`.
- Opt-in `hierarchicalCalibration.driftGuard` route input and a distinct guarded
  decision-report envelope type.

## Behavior

- A sufficiently sampled child is compared only with its immediate sufficiently
  sampled parent for the same exact task/provider/model identity.
- Only a raw child-minus-parent Brier delta strictly greater than the configured
  threshold is quarantined; equality remains within threshold.
- A quarantined child falls back to its parent. A child whose immediate parent
  cannot be validated is marked `parent_unavailable` and is not selected.
- Guarded reports reject impossible child-count and weighted-metric roll-ups.
- Combined guarded decisions bind candidate metrics, computed deltas, status,
  and the selected group back to the report. Standalone selection
  self-consistency was incomplete in v0.1.16 and is hardened in v0.1.17.

## Safety and compatibility

- The guard is outcome-metric drift detection, not semantic label verification.
- Parent aggregates include child observations, so the comparison is not an
  independent statistical test. Similar-performance mislabels can be missed and
  valid specialized buckets can be quarantined.
- The guard never renames or deletes labels and has no provider eligibility,
  ranking, weighting, quorum, budget, routing, or execution authority.
- Existing unguarded hierarchical schemas, output shape, route behavior, and
  legacy `DecisionReportEnvelope` TypeScript compatibility remain unchanged.

## Verification

- Full Deno unit and integration suite
- Typecheck, lint, format, frozen-lock, and diff checks
- Real SafeLoop production execution E2E
- Source/template byte parity
- Secret scan and independent Red/Blue/GLM/local-Qwen review
- GitHub Actions CI and tagged npm trusted-publication readback

## Migration

No migration is required. Existing callers receive the unguarded v1 decision
unless they explicitly provide `hierarchicalCalibration.driftGuard`.
