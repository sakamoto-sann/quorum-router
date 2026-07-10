# Product Hunt launch notes

External launch label: **Fusion Router v0.1**.

## Tagline options

- Fusion Router: fail-closed best-answer routing for LLM adapters.
- A readable Deno router for comparing model outputs safely.
- Open-source fusion routing with explicit runtime boundaries.

## Launch description

Fusion Router is a small, readable framework for routing a prompt across
multiple model adapters, validating outputs, and producing a final synthesis
through a fail-closed contract.

Fusion Router is open source under the **MIT License**.

## Runtime boundaries

- `direct` = production-ready best-answer routing path.
- `agent_chat` = experimental explicit opt-in multi-role runtime.
- No production autonomous runtime.
- No live Supabase Agent Bus runtime writes.
- No service-role runtime.
- No Supabase Realtime subscriber.

## Quickstart commands

Clone:

```bash
git clone https://github.com/sakamoto-sann/fusion-router.git
cd fusion-router
deno task smoke:v0.1
```

Scaffold a starter project:

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

npm package: `create-fusion-router@0.1.4`; npm dist-tag: `latest -> 0.1.4`.
`0.1.4` is an engineering patch for NPX scaffold / generated-demo compatibility,
not a separate product milestone.

Inspect the install helper:

```bash
curl -fsSL https://raw.githubusercontent.com/sakamoto-sann/fusion-router/v0.1.4/install.sh | sh -s -- --dry-run
```

## Maker comment draft

Fusion Router v0.1 is a Deno-based fusion router framework focused on readable
safety boundaries: default `direct` routing, Zod-validated outputs, fail-closed
errors, explicit non-goals, and no hidden production autonomous runtime. The
live npm scaffold is `create-fusion-router@0.1.4` (`latest ->
0.1.4`), an
engineering patch for NPX scaffold / generated-demo compatibility, not a
separate product milestone. Fusion Router is open source under the MIT License.
