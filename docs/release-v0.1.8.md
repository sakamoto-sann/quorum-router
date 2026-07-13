# QuorumRouter v0.1.8

QuorumRouter v0.1.8 adds deterministic calibration reports by task type to the
core API and the generated `create-quorum-router` scaffold.

## Highlights

- Aggregate caller-attested correctness observations by task type, provider, and
  model.
- Report accuracy, mean confidence, Brier score, and signed mean calibration
  bias.
- Preserve an explicit `advisory_only: true` boundary: calibration does not
  change routing weights, ranks, eligibility, quorum, or execution.
- Ship the same strict Calibration API in generated workspaces as
  `src/calibration.ts`.
- Add `deno task calibration:demo`; it makes no provider/API calls, while a
  first run may resolve the pinned Zod dependency.

## Validation and hardening

- Strict observation and report schemas with duplicate-ID and
  contradictory-report rejection.
- Deterministic metrics and group ordering regardless of observation order.
- Valid RFC 3339 UTC offsets, bounded identifiers and batches, Unicode NFC
  normalization, and rejection of control/default-ignorable identity characters.
- Maximum 10,000 observations per call and 256 characters per identity-bearing
  field.
- Caller trust, invocation binding, durable replay protection, label
  independence, and canonical model taxonomy remain explicit upstream
  responsibilities.

## Install

```bash
npx --yes create-quorum-router@0.1.8 my-quorum-router-demo
cd my-quorum-router-demo
deno task check
deno task smoke
deno task calibration:demo
```

## Release verification

The release gate requires repository formatting, lint, type checks, the full
Deno test suite, exact npm tarball allowlisting, secret scanning, GitHub
tag/Release readback, npm registry/provenance readback, and a clean
NPX-generated scaffold run.

QuorumRouter remains MIT-licensed open source. No service-role runtime, live
shared Supabase database, or default mutation capability is introduced by this
release.
