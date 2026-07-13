# QuorumRouter v0.1.13

QuorumRouter v0.1.13 adds advisory hierarchical calibration while preserving the
existing flat calibration API and routing behavior.

## Added

- Caller-defined `task_subtype` and optional `prompt_pattern` labels.
- Hierarchical aggregation across task type, subtype, and prompt-pattern groups.
- Explicit resolution in `prompt_pattern → task_subtype → task_type` order,
  using the first group that reaches the configured sample-count threshold.
- Decision Report evidence showing the requested scope, every fallback
  candidate, and the selected aggregate group.
- Generated scaffold exports for hierarchical aggregation and resolution.

## Safety and compatibility

- Calibration remains advisory and attach-only. It does not change provider
  eligibility, routing ranks, weights, quorum, budget, or execution.
- Groups remain isolated by exact provider and model identity.
- Labels are bounded caller-defined canonical identifiers; raw prompts and
  embeddings are rejected.
- Flat and hierarchical calibration inputs are mutually exclusive.
- The standalone selection schema binds the selected group to the query task,
  exact provider/model source, hierarchy labels, sufficient status, scope, and
  candidate sample count.
- Existing flat calibration v1 exports and behavior remain compatible.

## Verification

- Full Deno unit and integration suite
- Typecheck, lint, format, and frozen-lock verification
- Core/generated calibration implementation identity check
- README hierarchy example executed against the real API
- Generated package and tarball safety tests
- Real pinned SafeLoop execution E2E in the publish workflow
- Exact outgoing secret scans before push and publication
