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
- `direct` / Best Route is the production-ready best-answer routing path.
- `agent_chat` is experimental explicit opt-in.
- `deno task smoke` is deterministic fixture smoke only; it does not call a real
  provider API and is not external provider dogfood.
- `external:once` and `external:matrix` are real provider dogfood, manual opt-in
  only, and not run in CI.
- No provider credentials should be committed. Do not commit `.env`.

## Quick start: deterministic fixture smoke

```bash
deno task check
deno task smoke
```

`deno task smoke` imports `router.ts` from the published `v0.1.3` Git tag:

```text
https://raw.githubusercontent.com/sakamoto-sann/fusion-router/v0.1.3/router.ts
```

This generated project is prepared for `create-fusion-router@0.1.4`, but the
runtime import stays pinned to the latest published `v0.1.3` tag while this PR
is reviewed. Release closeout must create `v0.1.4` and update the generated
runtime tag before npm publish so package/runtime versions align.

## External provider dogfood

The generated scaffold supports the current real-provider dogfood set:

- Grok via `grok` CLI by default, or xAI OpenAI-compatible HTTP if configured;
- Devin via `devin` CLI;
- OpenAI via OpenAI-compatible HTTP, or Codex CLI with
  `FUSION_ROUTER_OPENAI_MODE=cli`.
- local Qwen via `qwen` CLI.
- GLM via OpenAI-compatible HTTP, or zcode-compatible CLI with
  `FUSION_ROUTER_GLM_MODE=cli`.

### 1. Check config/env only

```bash
deno task external:check
```

This checks the default single-provider path (`openai`) and sends **no**
provider request. If the credential is missing it fails closed with a message
such as:

```text
external dogfood blocked: missing FUSION_ROUTER_OPENAI_API_KEY or OPENAI_API_KEY
```

Check the full current-provider set without provider requests:

```bash
FUSION_ROUTER_EXTERNAL_PROVIDERS=grok,devin,openai,localqwen,glm \
  deno task external:check -- --matrix
```

The check confirms CLI command availability and provider credential env presence
without printing credential values.

### 2. Run exactly one real provider request

```bash
# Select one provider: grok, devin, openai, localqwen, or glm.
export FUSION_ROUTER_EXTERNAL_PROVIDER=openai
# For OpenAI HTTP, OPENAI_API_KEY or FUSION_ROUTER_OPENAI_API_KEY must be present.
RUN_EXTERNAL_MODEL_DOGFOOD=1 deno task external:once -- -- "Review this README change for risky launch claims."
```

`external:once` behavior:

- requires `RUN_EXTERNAL_MODEL_DOGFOOD=1`;
- makes exactly one real provider call for the selected provider;
- validates response shape;
- redacts secrets from diagnostics;
- writes `out/external-dogfood/external-once-trace.json`;
- never runs by default and is not required in CI.

### 3. Run all current dogfood providers

```bash
FUSION_ROUTER_EXTERNAL_PROVIDERS=grok,devin,openai,localqwen,glm \
RUN_EXTERNAL_MODEL_DOGFOOD=1 \
  deno task external:matrix -- -- "Compare direct fix vs refactor for this bug."
```

`external:matrix` makes one call per selected provider and writes
`out/external-dogfood/external-matrix-trace.json`.

## Provider env/config

HTTP providers:

- OpenAI: `FUSION_ROUTER_OPENAI_MODE=http`, `FUSION_ROUTER_OPENAI_BASE_URL`,
  `FUSION_ROUTER_OPENAI_API_KEY`, `FUSION_ROUTER_OPENAI_MODEL`; falls back to
  `OPENAI_API_KEY`. Use `FUSION_ROUTER_OPENAI_MODE=cli` to route OpenAI dogfood
  through Codex CLI with `FUSION_ROUTER_OPENAI_COMMAND` or `codex`.
- Grok HTTP mode: set `FUSION_ROUTER_GROK_MODE=http`, then configure
  `FUSION_ROUTER_GROK_BASE_URL`, `FUSION_ROUTER_GROK_API_KEY`,
  `FUSION_ROUTER_GROK_MODEL`; falls back to `XAI_API_KEY` / `GROK_API_KEY`.
- GLM: `FUSION_ROUTER_GLM_BASE_URL`, `FUSION_ROUTER_GLM_API_KEY`,
  `FUSION_ROUTER_GLM_MODEL`; falls back to `GLM_API_KEY`, `ZHIPUAI_API_KEY`, or
  `BIGMODEL_API_KEY`. Use `FUSION_ROUTER_GLM_MODE=cli` with
  `FUSION_ROUTER_GLM_COMMAND` for zcode-compatible local GLM dogfood.

CLI providers:

- Grok: `FUSION_ROUTER_GROK_COMMAND` or `grok`.
- Devin: `FUSION_ROUTER_DEVIN_COMMAND` or `devin`.
- local Qwen: `FUSION_ROUTER_LOCALQWEN_COMMAND` or `qwen`, with optional
  `FUSION_ROUTER_LOCALQWEN_MODEL`.

You may also copy `provider_config.example.json` to `provider_config.json` for
non-secret labels, base URLs, model names, or command names. Do not store
secrets in that file.

## What runs

`main.ts` is fixture-only for deterministic smoke. External provider dogfood
lives in:

- `external_provider.ts`
- `external_dogfood.ts`
- `provider_config.example.json`

Public Product Hunt/X launch is blocked until at least one external provider
dogfood pass is recorded by a human with local provider credentials. The richer
current-provider gate is Grok + Devin + OpenAI + local Qwen + GLM.
