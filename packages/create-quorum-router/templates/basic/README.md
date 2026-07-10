# QuorumRouter generated workspace

This generated workspace is for local, non-commercial evaluation of Fusion
Router current release. npm latest targets v0.1.4.

QuorumRouter is **Source-Available Non-Commercial**. It is **not open source**.
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
  `.quorum-router/`, or `out/` traces.
- Never paste tokens into chat/logs.
- Conversation-only `agent_chat` is explicit opt-in.
- SafeLoop-backed production repository execution is not enabled by this
  generated scaffold; it requires external signed policy and distinct approval.
- No service-role runtime.
- No live Supabase runtime writes.
- No live Supabase Agent Bus runtime writes.
- Best Route/direct is the production-ready best-answer routing path.
- `agent-chat` is read-only explicit opt-in only.

## First launch

Prerequisite: install Deno before running scaffold tasks. Verify with:

```bash
deno --version
```

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
`best-route`, or read-only `agent-chat`.

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
- In auto mode, `route:once` prefers list-verified wrapper models and safely
  tries the next wrapper when an invocation fails; the trace records the failed
  attempt and `fallback_used`.
- Explicit provider/model selection never falls back to a different wrapper.
- Env fallback is used only with `QUORUM_ROUTER_AUTH_MODE=env` and local private
  credential environment.
- Traces are redacted and written under `out/`.
- When the prompt contains a GitHub repository URL like
  `https://github.com/owner/repo`, `route:once`, `best-route`, and read-only
  `agent-chat` fetch a bounded, prioritized set of repository text files first,
  quote them as untrusted JSON data, and record context coverage in the trace.
  Only use this with repositories you are allowed to send to the selected
  provider.

### Forced wrapper provider/model selection

Use these only when you want a specific local wrapper/model. The scaffold fails
closed if the requested provider or model is unavailable; it never silently
falls back to OpenAI/Codex or private env fallback unless
`QUORUM_ROUTER_AUTH_MODE=env` is explicit.

```bash
QUORUM_ROUTER_AUTH_MODE=wrapper \
QUORUM_ROUTER_PROVIDER_LABEL=grok-cli \
QUORUM_ROUTER_PROVIDER_MODEL=grok-build \
RUN_EXTERNAL_MODEL_DOGFOOD=1 \
  deno task route:once --prompt "Review this README for risky claims."

QUORUM_ROUTER_AUTH_MODE=wrapper \
QUORUM_ROUTER_PROVIDER_LABEL=grok-cli \
QUORUM_ROUTER_PROVIDER_MODEL=grok-composer-2.5-fast \
RUN_EXTERNAL_MODEL_DOGFOOD=1 \
  deno task route:once --prompt "Review this README for usability."
```

Supported provider aliases include `grok-cli`, `grok`, `xai`, `xAI`, `OpenAI`,
`codex-cli`, `claude-code`, `gemini-cli`, `devin-cli`, and `qwen-cli`. Wrapper
invocations use argv arrays, closed stdin, timeout guards, and sanitized
stdout/stderr; CLI banners or auth/runtime errors are not accepted as valid
model answers.

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
QUORUM_ROUTER_AUTH_MODE=env \
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
  `provider_config.json`, and `.quorum-router/`.
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
