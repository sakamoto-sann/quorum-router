# Fusion Router evaluation demo

This demo is for local, non-commercial evaluation of Fusion Router v0.1 Public
RC.

Fusion Router is **Source-Available Non-Commercial**. This is **not open
source**. Production, commercial, hosted-service/SaaS/API, redistribution,
sublicensing, integration, derivative commercialization, or competing
product/service use requires prior written permission.

## Security and runtime boundaries

- Non-commercial evaluation only.
- No production autonomous runtime.
- No service-role runtime.
- No live Supabase runtime writes.
- No Supabase Realtime subscriber.
- `direct` is the production-ready best-answer routing path.
- `agent_chat` is experimental explicit opt-in.
- Fixture smoke does not ask for credentials or write secrets.
- Real API mode is explicit opt-in and reads provider credentials from local
  process environment variables only.
- Real API mode does not print credential values.
- The demo does not enable process adapters.

## Quick start: deterministic fixture smoke

```bash
deno task check
deno task smoke
```

`deno task smoke` imports `router.ts` from the published `v0.1.2` Git tag:

```text
https://raw.githubusercontent.com/sakamoto-sann/fusion-router/v0.1.2/router.ts
```

That means `deno task smoke` requires network access to
`raw.githubusercontent.com` and requires the `v0.1.2` tag to exist. The tag is
used intentionally so the generated demo follows the published GitHub release
URL. For reproducibility-sensitive evaluation, verify the `v0.1.2` Git tag
target in GitHub release metadata before running. The npm scaffold package is
live as `create-fusion-router@0.1.3`; `0.1.3` is an engineering patch for NPX
scaffold / generated-demo compatibility, not a separate product milestone.

## Real API mode

Use `deno task real` when you want Fusion Router to call a real provider API.
Real mode currently supports OpenAI Chat Completions and Anthropic Messages API
through the public `directHttp` adapters exported by Fusion Router.

Use your local shell or secret manager to provide one of these environment
variables before running real mode:

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`

Then run:

```bash
# auto: uses every configured real provider
deno task real -- "Review this README change for risky launch claims."

# force one provider
env FUSION_ROUTER_REAL_PROVIDER=openai deno task real -- "Choose direct fix vs refactor."
env FUSION_ROUTER_REAL_PROVIDER=anthropic deno task real -- "Summarize this PR and list blockers."
```

Real mode behavior:

- Calls real provider APIs only when you explicitly run `deno task real`.
- Reads credentials from `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`.
- Keeps `deno task real` network permissions scoped to
  `raw.githubusercontent.com`, `api.openai.com`, and `api.anthropic.com`.
- Never prints credential values.
- Uses `FusionRouter` direct mode with real direct-http model adapter(s).
- Uses local passthrough synthesis so a single real-provider key is enough for
  evaluation.
- Requires network access to `raw.githubusercontent.com` plus the selected
  provider API host.

If no supported credential is present, real mode fails closed with setup
instructions instead of silently falling back to fixtures.

## What runs

`main.ts` has two explicit modes:

- `--fixture` / `deno task smoke`: deterministic local fixture model and
  synthesis adapters; no provider API key required.
- `--real` / `deno task real`: real provider API model adapter(s) plus local
  passthrough synthesis; provider API key required.
