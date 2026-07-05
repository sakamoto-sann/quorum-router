# create-fusion-router

Create a local Fusion Router evaluation demo.

Fusion Router is **Source-Available Non-Commercial**. This is **not open
source**. Commercial, production, hosted-service/SaaS/API, redistribution,
sublicensing, integration, derivative commercialization, or competing
product/service use requires prior written permission.

## Usage

```bash
npx --yes create-fusion-router@latest my-fusion-router-demo
cd my-fusion-router-demo
deno task smoke
```

npm package target for this PR: `create-fusion-router@0.1.4`. Do not publish
this version until the PR is merged, v0.1.4 release/tag handling is approved,
and at least one external provider dogfood pass is recorded.

## What the generated project supports

```bash
deno task check
```

Checks the generated fixture and external dogfood TypeScript files.

```bash
deno task smoke
```

Runs deterministic fixture smoke only. It does not call an external provider API
and does not require provider credentials.

```bash
deno task external:check
```

Checks local env/config shape and verifies provider readiness without printing
credential values. It sends no provider request.

```bash
RUN_EXTERNAL_MODEL_DOGFOOD=1 deno task external:once
```

Manual opt-in real provider dogfood. It makes exactly one selected provider
call, validates response shape, redacts diagnostics, and writes a local trace
under `out/external-dogfood/`.

```bash
FUSION_ROUTER_EXTERNAL_PROVIDERS=grok,devin,openai,localqwen,glm \
RUN_EXTERNAL_MODEL_DOGFOOD=1 deno task external:matrix
```

Manual opt-in full current-provider dogfood. It supports Grok, Devin, OpenAI,
local Qwen, and GLM, making one call per selected provider.

## External provider env

Provider selection:

- `FUSION_ROUTER_EXTERNAL_PROVIDER` for `external:once`.
- `FUSION_ROUTER_EXTERNAL_PROVIDERS` for `external:matrix`.

HTTP provider env:

- OpenAI: `FUSION_ROUTER_OPENAI_MODE=http`, `FUSION_ROUTER_OPENAI_BASE_URL`,
  `FUSION_ROUTER_OPENAI_API_KEY`, `FUSION_ROUTER_OPENAI_MODEL`; falls back to
  `OPENAI_API_KEY`. Use `FUSION_ROUTER_OPENAI_MODE=cli` to route OpenAI dogfood
  through Codex CLI with `FUSION_ROUTER_OPENAI_COMMAND` or `codex`.
- Grok HTTP: `FUSION_ROUTER_GROK_MODE=http`, `FUSION_ROUTER_GROK_BASE_URL`,
  `FUSION_ROUTER_GROK_API_KEY`, `FUSION_ROUTER_GROK_MODEL`; falls back to
  `XAI_API_KEY` / `GROK_API_KEY`.
- GLM: `FUSION_ROUTER_GLM_BASE_URL`, `FUSION_ROUTER_GLM_API_KEY`,
  `FUSION_ROUTER_GLM_MODEL`; falls back to `GLM_API_KEY`, `ZHIPUAI_API_KEY`, or
  `BIGMODEL_API_KEY`. Use `FUSION_ROUTER_GLM_MODE=cli` with
  `FUSION_ROUTER_GLM_COMMAND` for zcode-compatible local GLM dogfood.

CLI provider env:

- Grok: `FUSION_ROUTER_GROK_COMMAND` or `grok`.
- Devin: `FUSION_ROUTER_DEVIN_COMMAND` or `devin`.
- local Qwen: `FUSION_ROUTER_LOCALQWEN_COMMAND` or `qwen`, with optional
  `FUSION_ROUTER_LOCALQWEN_MODEL`.

Do not commit `.env` files and do not print provider credentials.

## Runtime tag note

The generated fixture smoke currently imports the latest published runtime tag
`v0.1.3` for local PR verification. Before publishing
`create-fusion-router@0.1.4`, release closeout must create/update the `v0.1.4`
runtime tag/release flow and align the generated import with that release.

## CLI

```bash
create-fusion-router <dir>
create-fusion-router <dir> --template basic
create-fusion-router <dir> --force
create-fusion-router --help
create-fusion-router --version
```

The CLI refuses to overwrite a non-empty directory unless `--force` is passed.
