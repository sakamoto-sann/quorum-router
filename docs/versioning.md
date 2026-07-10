# Versioning and public preview policy

External launch label: **QuorumRouter v0.1 public preview**.

## What version numbers mean

Version numbers identify technical artifacts, not product completeness. The
`v0.1.x` line is the pre-1.0 public-RC engineering release line for repository
tags, release notes, npm scaffold packaging, and compatibility patches.

## Current public artifacts

- `v0.1.4` is the current public preview release line target for GitHub release
  tags, install-helper docs, and generated scaffold packaging.
- `create-quorum-router@0.1.4` is the current NPX package target.
- `create-quorum-router@latest` should resolve to `0.1.4` after release
  approval.
- `0.1.4` is an engineering patch for NPX scaffold / generated-demo
  compatibility, GitHub URL context dogfood, and release packaging hardening.

## Public quickstart

```bash
npx --yes create-quorum-router@latest my-quorum-router-demo
cd my-quorum-router-demo
deno task smoke
```

Fixed package version:

```bash
npx --yes create-quorum-router@0.1.4 my-quorum-router-demo
cd my-quorum-router-demo
deno task smoke
```

## Release discipline

- Do not bump the npm package version without explicit instruction.
- Do not create a new GitHub tag or release without explicit instruction.
- Future RCs should use an explicit prerelease and npm dist-tag policy before
  any publish step.

## License and runtime boundaries

QuorumRouter is **Source-Available Non-Commercial**. This is **not open
source**. Commercial, production, hosted-service/SaaS/API, redistribution,
sublicensing, integration, derivative commercialization, or competing
product/service use requires prior written permission.

- `direct` is the production-ready best-answer routing path.
- `agent_chat` is experimental explicit opt-in only.
- No production autonomous runtime.
- No live Supabase Agent Bus runtime writes.
- No service-role runtime.
