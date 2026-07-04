# X launch drafts — Fusion Router v0.1 Public RC

> Draft asset only. Do not post automatically from this file without explicit
> approval.

Links:

- GitHub release:
  https://github.com/sakamoto-sann/fusion-router/releases/tag/v0.1.3
- npm package: https://www.npmjs.com/package/create-fusion-router

## Short launch tweet

Fusion Router v0.1 Public RC is live.

A source-available routing/runtime framework for production-ready `direct`
best-answer routing and explicit opt-in experimental `agent_chat`.

```bash
npx --yes create-fusion-router@latest my-fusion-router-demo
cd my-fusion-router-demo
deno task smoke
```

GitHub: https://github.com/sakamoto-sann/fusion-router/releases/tag/v0.1.3 npm:
https://www.npmjs.com/package/create-fusion-router

Source-Available Non-Commercial; not open source.

## Technical launch tweet

Fusion Router v0.1 Public RC:

- `direct` = production-ready best-answer path
- Zod-validated adapter + synthesis outputs
- fail-closed runtime boundaries
- `agent_chat` = experimental explicit opt-in only
- no production autonomous runtime
- no live Supabase runtime writes
- no service-role runtime

Try:

```bash
npx --yes create-fusion-router@latest my-fusion-router-demo
cd my-fusion-router-demo
deno task smoke
```

Release: https://github.com/sakamoto-sann/fusion-router/releases/tag/v0.1.3 npm:
https://www.npmjs.com/package/create-fusion-router

License: Source-Available Non-Commercial, not open source.

## Longer thread: 7 tweets

### 1/7

Fusion Router v0.1 Public RC is live.

It is a source-available routing/runtime framework for builders who want routing
safety before agent autonomy.

Release: https://github.com/sakamoto-sann/fusion-router/releases/tag/v0.1.3 npm:
https://www.npmjs.com/package/create-fusion-router

### 2/7

Quickstart:

```bash
npx --yes create-fusion-router@latest my-fusion-router-demo
cd my-fusion-router-demo
deno task smoke
```

Expected result: the generated Deno demo prints a JSON result containing
`"ok": true`.

### 3/7

The stable path is `direct`.

`direct` fans out to model adapters, validates outputs, and synthesizes a best
answer through a fail-closed contract.

This is the production-ready best-answer routing path in v0.1 Public RC.

### 4/7

`agent_chat` exists, but it is experimental explicit opt-in only.

It is not a production autonomous runtime. It does not turn the project into a
full multi-agent production system.

### 5/7

Runtime boundaries are explicit:

- no production autonomous runtime
- no live Supabase Agent Bus runtime writes
- no service-role runtime
- no hidden runtime expansion from the scaffold

### 6/7

The npm package is `create-fusion-router@0.1.3`.

`0.1.3` is an engineering NPX scaffold / generated-demo compatibility patch in
the v0.1 Public RC line, not a separate product milestone.

`latest -> 0.1.3`.

### 7/7

License boundary:

Fusion Router is Source-Available Non-Commercial. It is not open source.

Commercial, production, hosted-service/SaaS/API, redistribution, sublicensing,
integration, derivative commercialization, or competing product/service use
requires prior written permission.

## Builder-focused thread: 6 tweets

### 1/6

If you are building with multiple model adapters, the hard part is not only
“call more models.”

It is deciding which path is allowed to run, validating every output, and
failing closed when the system cannot prove safety.

That is the focus of Fusion Router v0.1 Public RC.

### 2/6

Try the generated demo:

```bash
npx --yes create-fusion-router@latest my-fusion-router-demo
cd my-fusion-router-demo
deno task smoke
```

Then inspect `main.ts` and `deno.json`.

### 3/6

`direct` is the production-ready path.

It is the best-answer route: adapters produce structured outputs, validation
gates them, and synthesis produces the final response.

No autonomous agent runtime is required for that path.

### 4/6

`agent_chat` is included as an experimental explicit opt-in surface.

That boundary matters: no production autonomous runtime, no live Supabase
runtime writes, and no service-role runtime are claimed or enabled.

### 5/6

The launch artifact is the v0.1 Public RC line.

The npm package is `create-fusion-router@0.1.3`; `0.1.3` is a
scaffold/generated-demo compatibility patch, not a separate product milestone.

### 6/6

Release: https://github.com/sakamoto-sann/fusion-router/releases/tag/v0.1.3 npm:
https://www.npmjs.com/package/create-fusion-router

License: Source-Available Non-Commercial, not open source. Check permissions
before commercial or production use.

## “Routing first, agents second” thread: 6 tweets

### 1/6

Routing first, agents second.

That is the design stance behind Fusion Router v0.1 Public RC.

Before a system acts autonomously, it should have a clear routing boundary,
validation, and failure semantics.

### 2/6

In Fusion Router, `direct` is the production-ready best-answer path.

It keeps the core task simple: collect candidate outputs, validate them, and
synthesize a final answer without pretending the system is autonomous.

### 3/6

`agent_chat` is intentionally not the default.

It is experimental explicit opt-in only. If the caller does not opt in with the
required runtime config, it fails closed before adapter execution.

### 4/6

That boundary keeps the Public RC honest:

- no production autonomous runtime
- no live Supabase Agent Bus runtime writes
- no service-role runtime
- no full multi-agent production-system claim

### 5/6

Try the smallest public path:

```bash
npx --yes create-fusion-router@latest my-fusion-router-demo
cd my-fusion-router-demo
deno task smoke
```

The generated demo should print `"ok": true`.

### 6/6

Release: https://github.com/sakamoto-sann/fusion-router/releases/tag/v0.1.3 npm:
https://www.npmjs.com/package/create-fusion-router

Source-Available Non-Commercial; not open source. Commercial/production/SaaS/API
use requires prior written permission.
