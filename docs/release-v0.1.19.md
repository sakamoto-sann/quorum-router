# QuorumRouter v0.1.19

QuorumRouter v0.1.19 is a focused patch release for two defects reproduced
during v0.1.18 real-model dogfood. It does not change provider eligibility,
routing authority, quorum, synthesis, or execution behavior.

## Fixed

- Compute selection-regret uplift from integer success counts so mathematically
  equal oracle and best-single rates produce exact zero uplift and preserve the
  documented `capture_rate: null` denominator semantics.
- Strip trailing sentence periods from GitHub repository URLs detected in
  generated-workspace prompts, preventing false repository names and HTTP 404
  context-fetch failures.

## Verification

- Regression coverage for the equal two-thirds oracle/best-single case
- Regression coverage for sentence-final GitHub repository URLs
- Deno 2.9.2 formatting, frozen-lock, typecheck, lint, full test, doctor, and
  fixture smoke gates
- Real SafeLoop execute-request E2E with the pinned execution authority
- npm tarball allowlist verification
- Exact outgoing secret scans with gitleaks and the Hermes supplemental scanner

## Safety and compatibility

- Ensemble Quality Observability remains measurement-only, advisory-only, and
  dependent on caller-attested external ground truth.
- Missing or undefined rates remain explicit `null`; they are not fabricated as
  zero.
- Direct routing, Agent Chat, AgentRuntime, calibration, SafeLoop authority, and
  existing public schemas remain unchanged.
- The release preserves the MIT License.

## Release boundary

The immutable `v0.1.18` tag, GitHub Release, npm package, and npm `latest` tag
remain unchanged during this preparation PR. The `v0.1.19` source tag and npm
publish require a separate explicit authorization after final main readback.
