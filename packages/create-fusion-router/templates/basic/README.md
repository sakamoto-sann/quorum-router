# Fusion Router evaluation demo

This generated workspace is for local, non-commercial evaluation of Fusion
Router v0.1 Public RC. It is intended to be usable before release: fixture smoke
works without credentials, and real-provider dogfood is exposed through
explicit, fail-closed commands.

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
- `direct` / Best Route is the production-ready best-answer routing path.
- `agent_chat` is experimental explicit opt-in only.
- Do not paste API keys into chat or logs.
- Do not commit `.env`, `router.config.local.json`, `.fusion-router/`, or
  `out/`.
- Public Product Hunt/X launch remains blocked until real local dogfood passes.

## Quick start: deterministic fixture smoke

```bash
deno task check
deno task smoke
```

`deno task smoke` is fixture-only and credential-free. It does **not** call a
real provider API and is not external provider dogfood.

This generated project currently imports `router.ts` from the published `v0.1.3`
Git tag:

```text
https://raw.githubusercontent.com/sakamoto-sann/fusion-router/v0.1.3/router.ts
```

This is intentional for the pre-release local source scaffold: `v0.1.4` is not
published yet, so the generated smoke stays pinned to the latest published
runtime tag until release closeout aligns package/runtime versions.

## Usable OAuth/session-first dogfood commands

The generated scaffold exposes the same task surface that the v0.1.4 release
contract requires:

```bash
deno task auth:status
deno task auth:login
deno task route:once --prompt "Review this launch copy for risky claims."
deno task best-route --prompt "Choose the safer tagline."
deno task agent-chat --prompt "Review this local dogfood result."
```

Behavior:

- `auth:status` reports local session/config status safely and never prints
  tokens, secrets, or provider credential values.
- `auth:login` fails closed in this generated scaffold unless local
  OAuth/session setup has been explicitly wired. It points you to repo-local
  dogfood or explicit private fallback instead of asking you to paste API keys.
- `route:once` requires `RUN_EXTERNAL_MODEL_DOGFOOD=1` before any real provider
  call. By default it tries OAuth/session/local-wrapper style providers first.
- `best-route` also requires `RUN_EXTERNAL_MODEL_DOGFOOD=1`; with multiple
  configured wrapper providers it compares them, and with one provider it runs a
  single-route dogfood pass.
- `agent-chat` requires both `RUN_EXTERNAL_MODEL_DOGFOOD=1` and
  `RUN_EXPERIMENTAL_AGENT_CHAT=1`, and prints that it is experimental explicit
  opt-in. It does not imply production-ready Agent Chat.

## Preferred local wrapper/session path

Use local wrapper/session providers first. Examples include Grok CLI, Devin CLI,
and local Qwen CLI when those wrappers are already authenticated on your
machine. The default generated `route:once` blocks safely until an OAuth/session
marker is present; to use an already-authenticated local CLI wrapper before
release, select wrapper mode explicitly:

```bash
FUSION_ROUTER_AUTH_MODE=wrapper \
RUN_EXTERNAL_MODEL_DOGFOOD=1 \
  deno task route:once --prompt "Review this README for risky launch claims."
```

To choose another wrapper provider:

```bash
FUSION_ROUTER_AUTH_MODE=wrapper \
FUSION_ROUTER_EXTERNAL_PROVIDER=localqwen \
RUN_EXTERNAL_MODEL_DOGFOOD=1 \
  deno task route:once --prompt "Review this implementation plan."
```

For Best Route over multiple local wrappers:

```bash
FUSION_ROUTER_AUTH_MODE=wrapper \
FUSION_ROUTER_EXTERNAL_PROVIDERS=grok,devin,localqwen \
RUN_EXTERNAL_MODEL_DOGFOOD=1 \
  deno task best-route --prompt "Pick the safer launch claim."
```

If no local wrapper/session provider is available, these commands fail closed
and print the blocker without exposing secrets.

## Explicit private env fallback

Generic OpenAI-compatible env fallback is private/manual only. It is not the
primary public path and is never used silently in default `auto` mode.

Use it only when you intentionally select it in your local shell:

```bash
FUSION_ROUTER_AUTH_MODE=env \
RUN_EXTERNAL_MODEL_DOGFOOD=1 \
  deno task route:once --prompt "Review this README change."
```

Credential values must come from your local environment or secret manager. Do
not paste them into chat/logs, do not store them in `provider_config.json`, and
do not commit `.env`.

## Backward-compatible external aliases

These aliases remain for older docs and scripts:

```bash
deno task external:check
RUN_EXTERNAL_MODEL_DOGFOOD=1 deno task external:once --prompt "hello"
RUN_EXTERNAL_MODEL_DOGFOOD=1 deno task external:matrix --prompt "hello"
```

`external:check` sends no provider request. `external:once` maps to
`route:once`. `external:matrix` maps to `best-route`.

## Generated files

- `main.ts` — deterministic fixture smoke only.
- `external_provider.ts` — local wrapper and explicit env provider adapters.
- `external_dogfood.ts` — auth/status/login/route/best-route/agent-chat task
  surface.
- `provider_config.example.json` — non-secret labels/models/commands only.
- `.gitignore` — excludes `.env`, `.fusion-router/`, `router.config.local.json`,
  `provider_config.json`, and `out/`.

Product Hunt/X public launch remains blocked until a human records a real local
dogfood pass. This scaffold does not publish npm, create a GitHub release, or
mutate tags/dist-tags.
