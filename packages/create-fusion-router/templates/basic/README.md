# Fusion Router generated workspace

This generated workspace is for local, non-commercial evaluation of Fusion
Router v0.1 Public RC. npm latest is still v0.1.3 until release approval.

Fusion Router is **Source-Available Non-Commercial**. It is **not open source**.
Production, commercial, hosted-service/SaaS/API, redistribution, sublicensing,
derivative commercialization, or competing product/service use requires prior
written permission.

## Security and runtime boundaries

- Non-commercial evaluation only.
- `deno task smoke` is fixture-only and credential-free.
- `deno task intake` is the first real setup command.
- Real provider use is OAuth/session/wrapper-first.
- API key env fallback is private/manual only and never used silently.
- Never commit `.env`, `router.config.local.json`, `provider_config.json`,
  `.fusion-router/`, or `out/` traces.
- Never paste tokens into chat/logs.
- No production autonomous runtime.
- No service-role runtime.
- No live Supabase runtime writes.
- No live Supabase Agent Bus runtime writes.
- Best Route/direct is the production-ready best-answer routing path.
- `agent_chat` is experimental explicit opt-in only.

## First launch

```bash
deno task smoke
deno task intake
deno task auth:status
deno task models:list
deno task health
```

`smoke` proves the local scaffold runs with deterministic fixtures only. It does
**not** call a real provider API.

`intake` detects local provider wrappers, checks OAuth/session status, runs safe
model inventory/list-only probes where possible, writes local health traces
under `out/`, and recommends the next command.

In short: intake is the first real setup command before `route:once`,
`best-route`, or experimental `agent-chat`.

## Real provider dogfood commands

Run only after `intake` reports a usable OAuth/session/wrapper provider:

```bash
RUN_EXTERNAL_MODEL_DOGFOOD=1 deno task route:once --prompt "Review this README for risky claims."
RUN_EXTERNAL_MODEL_DOGFOOD=1 deno task best-route --prompt "Choose the safest launch copy."
RUN_EXTERNAL_MODEL_DOGFOOD=1 RUN_EXPERIMENTAL_AGENT_CHAT=1 deno task agent-chat --prompt "Review this launch plan."
```

Behavior:

- `route:once` requires `RUN_EXTERNAL_MODEL_DOGFOOD=1`.
- `best-route` requires `RUN_EXTERNAL_MODEL_DOGFOOD=1`.
- `agent-chat` requires both `RUN_EXTERNAL_MODEL_DOGFOOD=1` and
  `RUN_EXPERIMENTAL_AGENT_CHAT=1`.
- Default auth mode is OAuth/session/wrapper-first.
- Env fallback is used only with `FUSION_ROUTER_AUTH_MODE=env` and local private
  credential environment.
- Traces are redacted and written under `out/`.

## Auth and inventory

```bash
deno task auth:status
deno task auth:login
deno task auth:logout
deno task models:list
```

`auth:login` does not ask for API keys as the primary path. If OAuth/browser
login is not wired in this scaffold, it fails closed and tells you to use an
installed provider CLI login, then rerun `deno task intake`.

Browser/device login handling is safe-by-default: the scaffold does not open a
browser automatically. Provider CLIs own their own login flows.

## Private/manual env fallback

Generic OpenAI-compatible env fallback exists only as an explicit private
fallback:

```bash
FUSION_ROUTER_AUTH_MODE=env \
RUN_EXTERNAL_MODEL_DOGFOOD=1 \
  deno task route:once --prompt "Review this README change."
```

Credential values must come from your local environment or secret manager. Do
not paste them into chat/logs and do not commit `.env`.

## Generated files

- `main.ts` — deterministic fixture smoke only.
- `deno.json` — generated task surface.
- `README.md` — practical first-launch guide.
- `.gitignore` — excludes `.env`, `out/`, `router.config.local.json`,
  `provider_config.json`, and `.fusion-router/`.
- `router.config.example.json` — non-secret example boundaries.
- `src/cli.ts` — command dispatcher.
- `src/intake.ts` — first-run onboarding.
- `src/auth.ts`, `src/auth_oauth.ts`, `src/auth_session.ts`,
  `src/auth_env_fallback.ts` — auth/session/fallback boundaries.
- `src/provider_registry.ts`, `src/model_inventory.ts`, `src/wrapper_client.ts`,
  `src/provider_client.ts` — provider discovery and safe invocation.
- `src/best_route.ts`, `src/agent_chat.ts` — gated dogfood commands.
- `src/trace.ts`, `src/redact.ts`, `src/schema.ts`, `src/fixture_smoke.ts` —
  trace/redaction/schema/fixture support.
- `out/.gitkeep` — local output directory placeholder.

Public Product Hunt/X launch remains blocked until the user personally runs a
local pre-release workspace and approves release continuation. This scaffold
does not publish npm, create a GitHub release, or mutate tags/dist-tags.
