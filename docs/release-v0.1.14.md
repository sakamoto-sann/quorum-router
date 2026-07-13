# QuorumRouter v0.1.14

QuorumRouter v0.1.14 adds a deterministic offline demo for the advisory
hierarchical calibration API introduced in v0.1.13.

## Added

- `deno task calibration:hierarchy-demo` in newly generated workspaces.
- Three local fixture scenarios that demonstrate:
  - direct prompt-pattern selection when the narrowest group is sufficient;
  - fallback to task subtype when the prompt-pattern group is insufficient;
  - fallback to task type when both narrower groups are insufficient.
- Machine-readable output with candidate sample counts and statuses, the
  selected scope, configured threshold, and explicit advisory/no-provider
  boundaries.
- A foreign-source fixture showing that observations from another exact
  provider/model identity do not contribute to the queried source counts.

## Safety and compatibility

- The demo runs without Deno permissions and makes no provider, network,
  environment, or filesystem calls.
- Calibration remains advisory-only. The demo does not change provider
  eligibility, routing ranks, weights, quorum, budget, or execution.
- Labels are caller-defined canonical categories, not raw prompts.
- The existing flat calibration demo and all v0.1.13 hierarchical API behavior
  remain compatible.

## Verification

- Full Deno unit and integration suite
- Typecheck, lint, format, and frozen-lock verification
- Executed hierarchy demo with assertions for all three selected scopes and
  candidate sample statuses
- Exact npm tarball allowlist and source mode verification
- Secret scans before push and publication
- Fresh NPX-generated scaffold verification after publication

## Migration

No migration is required. Generate a new workspace or update an existing
workspace to use `deno task calibration:hierarchy-demo`.
