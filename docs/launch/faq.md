# QuorumRouter FAQ

## Is QuorumRouter open source?

No. QuorumRouter is Source-Available Non-Commercial. This is not an open source
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
current release positioning.

It routes through model adapters, validates structured outputs, and synthesizes
a final answer through fail-closed behavior.

## What is experimental?

The conversation-only `agent_chat` mode is explicit opt-in. The
production-capable local repository execution slice additionally requires
SafeLoop, signed policy, and distinct approval.

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

No. QuorumRouter does not claim a production autonomous runtime.

## Does it write to Supabase live runtime?

No. The current release does not claim live Supabase Agent Bus runtime writes.

Supabase Agent Bus docs describe contracts and future/live-runtime boundaries,
but the launch positioning does not claim live runtime writes.

## Does it require service-role credentials?

No. The launch path and generated demo do not require service-role credentials.

The runtime boundary explicitly excludes service-role runtime.

## Is `create-quorum-router` published on npm?

No. Public registry readback currently returns `E404`. The working source-backed
installer uses GitHub `main` and does not claim npm publication.

## Why NPX?

NPX gives evaluators a short, copy-pasteable way to create a local demo without
cloning the full repository first:

```bash
npx --yes github:sakamoto-sann/quorum-router#main my-quorum-router
cd my-quorum-router
deno task smoke
```

The generated demo is intentionally small and inspectable.

## How do I pin the source installer?

Use a reviewed Git tag or commit instead of `#main`:

```bash
npx --yes github:sakamoto-sann/quorum-router#<reviewed-commit> my-quorum-router
cd my-quorum-router
deno task smoke
```

For release reproducibility, also verify the GitHub release/tag metadata:

https://github.com/sakamoto-sann/quorum-router/releases/tag/v0.1.4

## How do I uninstall generated demo files?

The scaffold creates a local directory. Remove that directory:

```bash
rm -rf my-quorum-router-demo
```

If you used a different directory name, remove that directory instead.

## What can break?

Common issues:

- Deno is not installed.
- npm or npx cache resolves an unexpected GitHub source checkout.
- network access to `raw.githubusercontent.com` is blocked during
  `deno task smoke`.
- Deno import-map resolution fails if you run outside the generated demo
  directory or delete `deno.json`.
- future `main` changes may alter generated behavior; pin a reviewed tag or
  commit for reproducibility.

## How do I report issues?

Use the GitHub repository issue tracker:

https://github.com/sakamoto-sann/quorum-router/issues

When reporting an issue, include:

- operating system
- Deno version
- Node/npm version if the issue involves NPX
- command run
- full error output
- whether `#main`, a Git tag, or a commit was used
- whether network access to `raw.githubusercontent.com` is available
