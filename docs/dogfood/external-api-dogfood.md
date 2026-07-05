# External API dogfood gate

Fusion Router v0.1 public launch is **NO-GO** until at least one real external
provider dogfood path passes. Deterministic fixture smoke is still required for
CI and quick install validation, but fixture-only success is not evidence that a
user can use Fusion Router for real provider work.

## Required distinction

| Command                                                  |                  Provider call | Purpose                                          |      CI default |
| -------------------------------------------------------- | -----------------------------: | ------------------------------------------------ | --------------: |
| `deno task smoke`                                        |                             no | deterministic fixture smoke                      |             yes |
| `deno task external:check`                               |                             no | local env/config preflight                       | optional manual |
| `RUN_EXTERNAL_MODEL_DOGFOOD=1 deno task external:once`   |               yes, exactly one | one-provider dogfood                             |              no |
| `RUN_EXTERNAL_MODEL_DOGFOOD=1 deno task external:matrix` | yes, one per selected provider | Grok + Devin + OpenAI + local Qwen + GLM dogfood |              no |

## Generated scaffold

`create-fusion-router@0.1.4` prepares generated projects with:

- `main.ts` — fixture-only deterministic smoke;
- `external_provider.ts` — HTTP + CLI provider helper;
- `external_dogfood.ts` — check-only, once-only, and matrix dogfood runner;
- `provider_config.example.json` — non-secret provider config example;
- `deno.json` — CI-safe smoke plus manual external tasks.

## Provider support

The current dogfood provider set is:

- Grok via `grok` CLI by default, or xAI OpenAI-compatible HTTP with
  `FUSION_ROUTER_GROK_MODE=http`.
- Devin via `devin` CLI.
- OpenAI via OpenAI-compatible HTTP, or Codex CLI with
  `FUSION_ROUTER_OPENAI_MODE=cli`.
- local Qwen via `qwen` CLI.
- GLM via OpenAI-compatible HTTP, or zcode-compatible CLI with
  `FUSION_ROUTER_GLM_MODE=cli`.

## Provider env

Provider selection:

- `FUSION_ROUTER_EXTERNAL_PROVIDER=openai` for `external:once`.
- `FUSION_ROUTER_EXTERNAL_PROVIDERS=grok,devin,openai,localqwen,glm` for
  `external:matrix`.

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

Never commit `.env`. Never paste provider credentials into chat. Use a local
shell or secret-manager-injected environment.

## Check-only gate

Default single-provider check:

```bash
deno task external:check
```

Expected on an uncredentialed machine:

```text
external dogfood blocked: missing FUSION_ROUTER_OPENAI_API_KEY or OPENAI_API_KEY
```

Full current-provider preflight with no provider requests:

```bash
FUSION_ROUTER_EXTERNAL_PROVIDERS=grok,devin,openai,localqwen,glm \
  deno task external:check -- --matrix
```

This sends no provider request and must not print credential values.

## Once-only real provider dogfood

Run only when a human intentionally provides provider env:

```bash
FUSION_ROUTER_EXTERNAL_PROVIDER=openai \
RUN_EXTERNAL_MODEL_DOGFOOD=1 \
  deno task external:once -- -- "Review this README change for risky launch claims."
```

Expected behavior:

- makes exactly one real provider call;
- validates response shape;
- redacts diagnostics;
- writes `out/external-dogfood/external-once-trace.json`;
- fails closed if env/config is missing;
- never runs by default or in CI.

## Matrix real provider dogfood

Run this for the current-env gate:

```bash
FUSION_ROUTER_EXTERNAL_PROVIDERS=grok,devin,openai,localqwen,glm \
RUN_EXTERNAL_MODEL_DOGFOOD=1 \
  deno task external:matrix -- -- "Compare direct fix vs refactor for this bug."
```

This writes `out/external-dogfood/external-matrix-trace.json`.

## Trace requirements

Trace JSON must include:

- `run_id`
- `timestamp`
- provider label(s)
- model(s)
- request prompt
- response summary
- `schema_valid`
- `redaction_ok`
- `credential_used`
- `credential_value_present` set to false
- `sensitive_value_present` set to false
- runtime boundaries

Trace JSON must not include provider credential values.

## Public launch rule

Product Hunt/X launch remains **NO-GO** until:

1. generated fixture smoke passes;
2. `external:check` succeeds on a credentialed machine without printing secrets;
3. `external:once` passes once with a real provider;
4. ideally, the full Grok + Devin + OpenAI + local Qwen + GLM matrix passes;
5. trace JSON is reviewed and contains no provider credential values;
6. no P0/P1 dogfood bugs remain open.
