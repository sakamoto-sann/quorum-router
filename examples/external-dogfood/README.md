# QuorumRouter external provider dogfood example

This example is the committed counterpart of the generated
`create-quorum-router` external dogfood scaffold.

## Purpose

`deno task smoke` is deterministic fixture-only and CI/demo safe. It is useful
for checking install and wiring, but it is **not** real provider dogfood.

`external:once` is manual opt-in real provider dogfood. It makes exactly one
provider call when `RUN_EXTERNAL_MODEL_DOGFOOD=1` is set and local provider
configuration is present.

`external:matrix` is the fuller current-env dogfood gate for Grok + Devin +
OpenAI + local Qwen + GLM. It is also manual opt-in and makes one call per
selected provider.

## Commands

```bash
deno task check
deno task external:check
RUN_EXTERNAL_MODEL_DOGFOOD=1 deno task external:once
QUORUM_ROUTER_EXTERNAL_PROVIDERS=grok,devin,openai,localqwen,glm \
RUN_EXTERNAL_MODEL_DOGFOOD=1 deno task external:matrix -- -- "Compare direct fix vs refactor."
```

`external:check` validates env/config and confirms provider readiness without
printing credential values. It sends no provider request.

`external:once` writes a local trace to:

```text
out/external-dogfood/external-once-trace.json
```

`external:matrix` writes:

```text
out/external-dogfood/external-matrix-trace.json
```

## Providers

The scaffold supports:

- Grok via `grok` CLI by default, or xAI OpenAI-compatible HTTP with
  `QUORUM_ROUTER_GROK_MODE=http`.
- Devin via `devin` CLI.
- OpenAI via OpenAI-compatible HTTP, or Codex CLI with
  `QUORUM_ROUTER_OPENAI_MODE=cli`.
- local Qwen via `qwen` CLI.
- GLM via OpenAI-compatible HTTP, or zcode-compatible CLI with
  `QUORUM_ROUTER_GLM_MODE=cli`.

## Env/config

Use local env or a secret-manager-injected shell. Do not commit `.env` and do
not print provider credentials.

Useful env vars:

- `QUORUM_ROUTER_EXTERNAL_PROVIDER` for a single provider.
- `QUORUM_ROUTER_EXTERNAL_PROVIDERS` for matrix mode.
- Generic OpenAI-compatible default: `QUORUM_ROUTER_PROVIDER_BASE_URL`,
  `QUORUM_ROUTER_PROVIDER_API_KEY`, `QUORUM_ROUTER_PROVIDER_MODEL`, and optional
  `QUORUM_ROUTER_PROVIDER_LABEL`.
- `QUORUM_ROUTER_OPENAI_API_KEY` or `OPENAI_API_KEY`.
- `QUORUM_ROUTER_GLM_API_KEY` or `GLM_API_KEY` / `ZHIPUAI_API_KEY` /
  `BIGMODEL_API_KEY`.
- `QUORUM_ROUTER_GROK_API_KEY` or `XAI_API_KEY` / `GROK_API_KEY` when using Grok
  HTTP mode.
- `QUORUM_ROUTER_*_COMMAND` overrides for CLI providers.

`provider_config.example.json` contains only non-secret labels, model names,
base URLs, and command names.

## Launch gate

Product Hunt/X launch remains blocked until at least one external provider pass
exists and its trace is reviewed for secret safety. The richer internal gate is
Grok + Devin + OpenAI + local Qwen + GLM.
