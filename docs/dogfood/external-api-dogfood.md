# External API dogfood gate

Fusion Router v0.1 public launch is **NO-GO** until local real-model dogfood
passes in the user's own environment. NPX is not the goal. Deterministic fixture
smoke is still required for CI and quick install validation, but fixture-only
success is not evidence that a user can use Fusion Router for real provider
work.

The primary dogfood path is repo-local and generated-scaffold-compatible:

```bash
cd examples/local-model-dogfood
deno task intake
deno task auth:status
deno task models:list
deno task health
RUN_EXTERNAL_MODEL_DOGFOOD=1 deno task route:once --prompt "Review this README for risky claims."
RUN_EXTERNAL_MODEL_DOGFOOD=1 deno task best-route --prompt "Choose the safest launch copy."
```

Model inventory must be read from actual local wrapper/session/provider state.
Generic API-key env fallback is explicit-only private dogfood, not the primary
public launch proof.

## Required distinction

| Command                                             |                      Provider call | Purpose                                                              | CI default |
| --------------------------------------------------- | ---------------------------------: | -------------------------------------------------------------------- | ---------: |
| `deno task smoke`                                   |                                 no | deterministic fixture smoke                                          |        yes |
| `deno task intake`                                  |                 no generation call | first-run OAuth/session/wrapper onboarding and health recommendation |     manual |
| `deno task auth:status`                             |                 no generation call | redacted auth/session status                                         |     manual |
| `deno task models:list`                             |          list-only where supported | model inventory without prompt generation                            |     manual |
| `deno task health`                                  |                 no generation call | redacted health trace                                                |     manual |
| `RUN_EXTERNAL_MODEL_DOGFOOD=1 deno task route:once` | yes, exactly one selected provider | one-provider dogfood                                                 |         no |
| `RUN_EXTERNAL_MODEL_DOGFOOD=1 deno task best-route` |      yes, one per usable candidate | best-route dogfood                                                   |         no |

## Generated scaffold

`create-fusion-router@0.1.4` prepares generated projects with:

- `main.ts` — fixture-only deterministic smoke;
- `deno.json` — `intake`, `auth:*`, `models:list`, `health`, `route:once`,
  `best-route`, and experimental `agent-chat` tasks;
- `README.md` — first-launch guide;
- `.gitignore` — excludes `.env`, `out/`, `router.config.local.json`, and
  `.fusion-router/`;
- `router.config.example.json` — non-secret configuration boundaries;
- `src/` — command dispatcher,
  intake/auth/session/fallback/model-inventory/wrapper/trace/redaction helpers.

## Provider support

The current dogfood provider set is wrapper/session-first:

- Grok via `grok` CLI session.
- Devin via `devin` CLI session.
- Codex/OpenAI via local CLI session where installed.
- Claude/Gemini via local CLI session where installed.
- local Qwen via `qwen` CLI.
- Explicit private env fallback only with `FUSION_ROUTER_AUTH_MODE=env`.

## Onboarding and check-only gate

Default generated-scaffold first run:

```bash
deno task smoke
deno task intake
deno task auth:status
deno task models:list
deno task health
```

Expected on an uncredentialed machine: fail-closed/no-provider guidance, no
generation request, and no credential values printed. That is safe but does not
satisfy the public launch gate.

## Once-only real provider dogfood

Run only after `intake` reports a usable OAuth/session/wrapper provider:

```bash
RUN_EXTERNAL_MODEL_DOGFOOD=1 \
  deno task route:once --prompt "Review this README change for risky launch claims."
```

Expected behavior:

- makes exactly one real provider call;
- validates response shape;
- redacts diagnostics;
- writes `out/route-once-trace.json`;
- fails closed if no provider is available;
- never runs by default or in CI.

## Best Route real provider dogfood

Run this for the current-env best-route gate:

```bash
RUN_EXTERNAL_MODEL_DOGFOOD=1 \
  deno task best-route --prompt "Compare direct fix vs refactor for this bug."
```

This writes `out/best-route-trace.json`.

## Experimental Agent Chat

`agent-chat` is not production-ready and remains explicit opt-in:

```bash
RUN_EXTERNAL_MODEL_DOGFOOD=1 RUN_EXPERIMENTAL_AGENT_CHAT=1 \
  deno task agent-chat --prompt "Review this launch plan."
```

## Trace requirements

Trace JSON must include:

- `run_id`
- `timestamp`
- provider/model where applicable
- prompt/response summaries only
- `schema_valid`
- `redaction_ok`
- `credential_value_present` set to false
- `sensitive_value_present` set to false
- runtime boundaries

Trace JSON must not include provider credential values.

## Public launch rule

Product Hunt/X launch remains **NO-GO** until:

1. generated fixture smoke passes;
2. generated/repo-local `intake`, `auth:status`, `models:list`, and `health` are
   reviewed without secrets;
3. `route:once` passes once with a real OAuth/session/wrapper provider;
4. `best-route` passes with the available local provider set or unavailable
   providers are documented with evidence;
5. trace JSON is reviewed and contains no provider credential values;
6. no P0/P1 dogfood bugs remain open.
