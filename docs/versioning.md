# Versioning and public preview policy

External launch label: **QuorumRouter v0.1 public preview**.

## What version numbers mean

Version numbers identify technical artifacts, not product completeness. The
`v0.1.x` line is the pre-1.0 public engineering release line for repository
tags, release notes, npm scaffold packaging, and compatibility patches.

## Current public artifacts

- `v0.1.8` is the current public preview release line target for GitHub release
  tags, install-helper docs, and generated scaffold packaging.
- `create-quorum-router@0.1.8` is the current NPX package target.
- `create-quorum-router@latest` should resolve to `0.1.8` after release
  approval.
- `0.1.8` adds deterministic advisory task calibration to the core and generated
  scaffold while preserving fail-closed routing and MIT licensing.

## Public quickstart

```bash
npx --yes create-quorum-router@latest my-quorum-router-demo
cd my-quorum-router-demo
deno task smoke
```

Fixed package version:

```bash
npx --yes create-quorum-router@0.1.8 my-quorum-router-demo
cd my-quorum-router-demo
deno task smoke
```

## Release discipline

- Do not bump the npm package version without explicit instruction.
- Do not create a new GitHub tag or release without explicit instruction.
- Future RCs should use an explicit prerelease and npm dist-tag policy before
  any publish step.

## License and runtime boundaries

QuorumRouter is **MIT-licensed open source**. Commercial and production use are
permitted under the MIT License.

- `direct` is the production-ready best-answer routing path.
- `agent_chat` is experimental explicit opt-in only.
- No production autonomous runtime.
- No live Supabase Agent Bus runtime writes.
- No service-role runtime.
