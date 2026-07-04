# Versioning and Public RC policy

External launch label: **Fusion Router v0.1 Public RC**.

## What version numbers mean

Version numbers identify technical artifacts, not product completeness. The
`v0.1.x` line is the pre-1.0 public-RC engineering release line for repository
tags, release notes, npm scaffold packaging, and compatibility patches.

## Current public artifacts

- `v0.1.2` is the GitHub security hardening release used by the generated demo's
  tagged runtime import.
- `create-fusion-router@0.1.3` is the first live NPX package.
- `create-fusion-router@latest` currently resolves to `0.1.3`.
- `0.1.3` is an engineering patch for NPX scaffold / generated-demo
  compatibility, not a separate product milestone.

## Public quickstart

```bash
npx --yes create-fusion-router@latest my-fusion-router-demo
cd my-fusion-router-demo
deno task smoke
```

Fixed package version:

```bash
npx --yes create-fusion-router@0.1.3 my-fusion-router-demo
cd my-fusion-router-demo
deno task smoke
```

## Release discipline

- Do not bump the npm package version without explicit instruction.
- Do not create a new GitHub tag or release without explicit instruction.
- Future RCs should use an explicit prerelease and npm dist-tag policy before
  any publish step.

## License and runtime boundaries

Fusion Router is **Source-Available Non-Commercial**. This is **not open
source**. Commercial, production, hosted-service/SaaS/API, redistribution,
sublicensing, integration, derivative commercialization, or competing
product/service use requires prior written permission.

- `direct` is the production-ready best-answer routing path.
- `agent_chat` is experimental explicit opt-in only.
- No production autonomous runtime.
- No live Supabase Agent Bus runtime writes.
- No service-role runtime.
