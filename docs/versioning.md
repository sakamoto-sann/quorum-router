# Versioning and v0.1 release policy

External launch label: **Fusion Router v0.1**.

## What version numbers mean

Version numbers identify technical artifacts, not product completeness. The
`v0.1.x` is the pre-1.0 public engineering release line for repository tags,
release notes, npm scaffold packaging, and compatibility patches.

## Current public artifacts

- `v0.1.4` is the current v0.1 release line target for GitHub release tags,
  install-helper docs, and generated scaffold packaging.
- `create-fusion-router@0.1.4` is the current NPX package target.
- `create-fusion-router@latest` should resolve to `0.1.4` after release
  approval.
- `0.1.4` is an engineering patch for NPX scaffold / generated-demo
  compatibility, GitHub URL context dogfood, and release packaging hardening.

## Public quickstart

```bash
npx --yes create-fusion-router@latest my-fusion-router-demo
cd my-fusion-router-demo
deno task smoke
```

Fixed package version:

```bash
npx --yes create-fusion-router@0.1.4 my-fusion-router-demo
cd my-fusion-router-demo
deno task smoke
```

## Release discipline

- Do not bump the npm package version without explicit instruction.
- Do not create a new GitHub tag or release without explicit instruction.
- Future RCs should use an explicit prerelease and npm dist-tag policy before
  any publish step.

## License and runtime boundaries

Fusion Router is open source under the **MIT License**.

- `direct` is the production-ready best-answer routing path.
- `agent_chat` is experimental explicit opt-in only.
- No production autonomous runtime.
- No live Supabase Agent Bus runtime writes.
- No service-role runtime.
