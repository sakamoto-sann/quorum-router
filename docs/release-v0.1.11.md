# QuorumRouter v0.1.11

QuorumRouter v0.1.11 is a least-privilege hotfix for the generated scaffold and
local provider dogfood tasks.

## Fixed

- Removed the excluded Qwen wrapper from generated `--allow-run` process
  permissions.
- Removed the same stale permission from local route, Best Route, and Agent Chat
  dogfood tasks.
- Added a release contract test that prevents generated tasks from granting
  process execution permission to Qwen while no supported non-secret session
  provider spec exists.

## Unchanged boundaries

- Qwen remains excluded from automatic session candidates until a non-secret
  session path is available.
- Explicit generic private env fallback remains available for user-controlled
  OpenAI-compatible endpoints.
- The separate external dogfood utility retains its explicit Local Qwen
  integration and permission because that surface implements and selects it
  directly.
- Calibration remains caller-attested, advisory-only, and attach-only.
- SafeLoop mutation still requires explicit execution authority and separate
  digest-bound approval.

## Verification

- formatting, lint, type checks, full tests, and deterministic smoke
- required real SafeLoop execution E2E
- generated package/tarball contract checks
- exact outgoing and whole-tree secret scans
- clean public NPX generation and route execution readback
