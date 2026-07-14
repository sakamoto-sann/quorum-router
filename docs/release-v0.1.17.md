# QuorumRouter v0.1.17

QuorumRouter v0.1.17 is a schema-hardening hotfix for the opt-in hierarchical
calibration drift guard introduced in v0.1.16.

## Fixed

- Guarded selections now carry `minimum_sample_count` and bind every candidate's
  `sample_status` to that threshold.
- Guarded report and candidate audit rows reject contradictory calibration bias
  and require accuracy to equal the canonical stable ratio of an integer correct
  count to `sample_count`.
- The legacy unguarded hierarchical report schema remains unchanged.
- Guarded decision and composed envelope `safeParse()` calls return validation
  failure for malformed nested reports instead of leaking a nested `ZodError`.
- `DecisionReportSchema` and `DecisionReportEnvelopeSchema` again infer their
  original unguarded v1 TypeScript outputs. Explicit guarded/union consumers use
  the new `DecisionReportAnySchema`, `DecisionReportEnvelopeAnySchema`, or the
  guarded-specific schemas and types.

## Compatibility

- Existing unguarded hierarchical selection output and the two-argument resolver
  remain unchanged.
- The drift guard remains opt-in and advisory-only. It cannot change provider
  eligibility, rank, weight, quorum, budget, routing, or execution.
- Guarded v1 selections emitted by v0.1.17 include the required
  `minimum_sample_count` audit field. Consumers persisting v0.1.16 guarded
  selections should regenerate them from the original report before validation.

## Validation boundary

Standalone guarded selections validate internal consistency, not producer
identity or observation provenance. Validate the combined guarded decision to
bind a selection to its report; separately establish evaluator trust, invocation
binding, and durable replay protection.

## Verification

- Focused schema regressions for all late-review blockers
- Full Deno unit/integration suite and generated scaffold checks
- Typecheck, lint, formatting, lockfile, diff, secret scan, and independent
  review
- GitHub Actions trusted publishing, registry provenance readback, and fresh NPX
  scaffold smoke verification
