# X launch drafts — Fusion Router v0.1 Public RC

> Draft asset only. Do not post automatically from this file without explicit
> approval.

Links:

- GitHub release:
  https://github.com/sakamoto-sann/fusion-router/releases/tag/v0.1.3
- npm package: https://www.npmjs.com/package/create-fusion-router

## Short launch tweet

Fusion Router v0.1 Public RC is live.

A source-available routing/runtime framework for production-ready Best Route /
`direct` best-answer routing and explicit opt-in experimental `agent_chat`.

GIF 1 shows Best Route mode choosing the best answer path. GIF 2 shows
experimental Agent Chat mode solving a puzzle through explicit multi-role
conversation.

Source-Available Non-Commercial; not open source.

## Technical launch tweet

Fusion Router v0.1 Public RC:

- Best Route / `direct` = production-ready best-answer path
- Zod-validated adapter + synthesis outputs
- fail-closed runtime boundaries
- `agent_chat` = experimental explicit opt-in only
- Best Route does not imply `agent_chat`
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

## Two-GIF thread: 7 tweets

### 1/7

Fusion Router v0.1 Public RC is live.

It is a source-available routing/runtime framework for builders who want routing
safety before agent autonomy.

Release: https://github.com/sakamoto-sann/fusion-router/releases/tag/v0.1.3 npm:
https://www.npmjs.com/package/create-fusion-router

### 2/7

GIF 1 shows Best Route mode choosing the best answer path.

The demo compares deterministic direct routes for a small Three Doors puzzle,
scores consistency/risk, selects `structured_direct`, and returns Door C.

### 3/7

GIF 2 shows experimental Agent Chat mode solving a puzzle through explicit
multi-role conversation.

Commander, Solver, Reviewer, Red Team, and Closeout correct a tempting Door B
answer and end on Door C.

### 4/7

These GIFs are intentionally separate.

Best Route / `direct` is the production-ready best-answer routing path.
`agent_chat` is experimental explicit opt-in only.

Best Route does not imply `agent_chat`.

### 5/7

Quickstart:

```bash
npx --yes create-fusion-router@latest my-fusion-router-demo
cd my-fusion-router-demo
deno task smoke
```

The generated Deno demo should print a JSON result containing `"ok": true`.

### 6/7

Runtime boundaries:

- no production autonomous runtime
- no live Supabase Agent Bus runtime writes
- no service-role runtime
- no hidden runtime expansion from the scaffold

### 7/7

The npm package is `create-fusion-router@0.1.3`; `latest -> 0.1.3`.

`0.1.3` is an engineering NPX scaffold / generated-demo compatibility patch in
the v0.1 Public RC line, not a separate product milestone.

Source-Available Non-Commercial; not open source.

## Builder-focused thread: 6 tweets

### 1/6

If you are building with multiple model adapters, the hard part is not only
“call more models.”

It is deciding which path is allowed to run, validating every output, and
failing closed when the system cannot prove safety.

That is the focus of Fusion Router v0.1 Public RC.

### 2/6

The stable path is Best Route / `direct`.

It compares answer routes, validates outputs, and synthesizes a final answer
without pretending the system is autonomous.

GIF 1 shows this path choosing the best answer.

### 3/6

`agent_chat` is included as an experimental explicit opt-in surface.

GIF 2 shows it as a role conversation demo, not as the default route and not a
claim of production-ready autonomy.

### 4/6

The mode boundary matters:

- Best Route does not imply `agent_chat`
- no production autonomous runtime
- no live Supabase runtime writes
- no service-role runtime

### 5/6

Try the generated demo:

```bash
npx --yes create-fusion-router@latest my-fusion-router-demo
cd my-fusion-router-demo
deno task smoke
```

Then inspect `main.ts` and `deno.json`.

### 6/6

Release: https://github.com/sakamoto-sann/fusion-router/releases/tag/v0.1.3 npm:
https://www.npmjs.com/package/create-fusion-router

License: Source-Available Non-Commercial, not open source. Check permissions
before commercial or production use.
