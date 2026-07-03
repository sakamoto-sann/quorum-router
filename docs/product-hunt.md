# Product Hunt launch notes

## Tagline options

- Fusion Router: fail-closed best-answer routing for LLM adapters.
- A readable Deno router for comparing model outputs safely.
- Source-available fusion routing with explicit runtime boundaries.

## Launch description

Fusion Router is a small, readable proof-of-concept for routing a prompt across
multiple model adapters, validating outputs, and producing a final synthesis
through a fail-closed contract.

Fusion Router is **Source-Available Non-Commercial**. This is **not open
source**. Commercial, production, hosted-service/SaaS/API, redistribution,
sublicensing, integration, derivative commercialization, or competing
product/service use requires prior written permission.

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

Scaffold an evaluation demo:

```bash
npx create-fusion-router@latest my-fusion-router-demo
cd my-fusion-router-demo
deno task smoke
```

Inspect the install helper:

```bash
curl -fsSL https://raw.githubusercontent.com/sakamoto-sann/fusion-router/v0.1.2/install.sh | sh -s -- --dry-run
```

## Maker comment draft

Fusion Router is a Deno-based fusion router PoC focused on readable safety
boundaries: default `direct` routing, Zod-validated outputs, fail-closed errors,
explicit non-goals, and no hidden production autonomous runtime. v0.1.2 is a
security hardening release with redaction/temp-file improvements plus easier
evaluation paths through `npx create-fusion-router` and a tagged install helper.
It is Source-Available Non-Commercial, not open source; commercial or production
use requires prior written permission.
