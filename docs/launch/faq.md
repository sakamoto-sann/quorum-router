# Fusion Router v0.1 Public RC FAQ

## Is Fusion Router open source?

No. Fusion Router is Source-Available Non-Commercial. This is not an open source
license.

The source is available for source review, personal evaluation, academic or
non-commercial research, and non-production testing under the license terms.

## Can I use this commercially?

Not without prior written permission.

Commercial, production, hosted-service/SaaS/API, redistribution, sublicensing,
integration, derivative commercialization, or competing product/service use
requires prior written permission.

## What is production-ready?

The `direct` path is the production-ready best-answer routing path in the v0.1
Public RC positioning.

It routes through model adapters, validates structured outputs, and synthesizes
a final answer through fail-closed behavior.

## What is experimental?

`agent_chat` is experimental explicit opt-in only.

It requires explicit runtime configuration and opt-in. If those requirements are
not met, it fails closed before adapter execution.

## What does `direct` do?

`direct` is the default best-answer routing mode. It fans out to adapters,
validates their responses, and asks the synthesis adapter to produce a final
answer from validated candidates.

## What does `agent_chat` do?

`agent_chat` is an experimental multi-role routing/runtime surface. It is
designed for explicit opt-in experiments with role-based
planning/review/closeout behavior.

It is not the default path and is not claimed as production-ready.

## Does this run autonomous agents in production?

No. Fusion Router v0.1 Public RC does not claim a production autonomous runtime.

## Does it write to Supabase live runtime?

No. The Public RC does not claim live Supabase Agent Bus runtime writes.

Supabase Agent Bus docs describe contracts and future/live-runtime boundaries,
but the launch positioning does not claim live runtime writes.

## Does it require service-role credentials?

No. The launch path and generated demo do not require service-role credentials.

The runtime boundary explicitly excludes service-role runtime.

## Why npm version 0.1.3 but label v0.1 Public RC?

The external launch label is **Fusion Router v0.1 Public RC**.

The npm package is `create-fusion-router@0.1.3` with `latest -> 0.1.3`. Version
`0.1.3` is an engineering NPX scaffold / generated-demo compatibility patch in
the v0.1 Public RC line, not a separate product milestone.

## Why NPX?

NPX gives evaluators a short, copy-pasteable way to create a local demo without
cloning the full repository first:

```bash
npx --yes create-fusion-router@latest my-fusion-router-demo
cd my-fusion-router-demo
deno task smoke
```

The generated demo is intentionally small and inspectable.

## How do I pin a version?

Use the fixed package version:

```bash
npx --yes create-fusion-router@0.1.3 my-fusion-router-demo
cd my-fusion-router-demo
deno task smoke
```

For release reproducibility, also verify the GitHub release/tag metadata:

https://github.com/sakamoto-sann/fusion-router/releases/tag/v0.1.3

## How do I uninstall generated demo files?

The scaffold creates a local directory. Remove that directory:

```bash
rm -rf my-fusion-router-demo
```

If you used a different directory name, remove that directory instead.

## What can break?

Common issues:

- Deno is not installed.
- npm or npx cache resolves an unexpected package version.
- network access to `raw.githubusercontent.com` is blocked during
  `deno task smoke`.
- Deno import-map resolution fails if you run outside the generated demo
  directory or delete `deno.json`.
- future npm/package versions may change generated-demo behavior; pin
  `create-fusion-router@0.1.3` to reproduce this Public RC scaffold.

## How do I report issues?

Use the GitHub repository issue tracker:

https://github.com/sakamoto-sann/fusion-router/issues

When reporting an issue, include:

- operating system
- Deno version
- Node/npm version if the issue involves NPX
- command run
- full error output
- whether `create-fusion-router@latest` or a fixed version was used
- whether network access to `raw.githubusercontent.com` is available
