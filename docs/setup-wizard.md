# Setup wizard and config generator

QuorumRouter now ships a dry-run setup surface for creating a safe
`quorum-router.config.json` plus environment placeholder guidance. It does not
perform network calls, validate live credentials, store secrets, or run OAuth
login flows.

## Quick start

Dry-run is the default:

```bash
deno task setup -- --profile minimal-direct
```

Write a config only when you pass `--write`:

```bash
deno task setup -- --profile direct-http-openai --write quorum-router.config.json
```

You can also choose an explicit output path:

```bash
deno task setup -- --profile adaptive-direct --write ./config/quorum-router.config.json
```

The command prints three sections:

1. generated config JSON;
2. env placeholder guidance;
3. doctor-readiness expectations, warnings, and non-goals.

## Profiles

| Profile                 | Purpose                                                                                                     | Secrets emitted? |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------- |
| `minimal-direct`        | Minimal `direct` mode config with no provider selection.                                                    | No               |
| `direct-http-openai`    | OpenAI direct HTTP descriptor plus an empty provider API-key placeholder.                                   | No               |
| `direct-http-anthropic` | Anthropic direct HTTP descriptor plus an empty provider API-key placeholder.                                | No               |
| `cli-oauth`             | Codex / Claude Code / Gemini / Grok / ZCode wrapper descriptors using OAuth/session surfaces.               | No               |
| `adaptive-direct`       | Safe Adaptive Direct config with `safe_provider_unavailable_only` fallback and budget placeholder guidance. | No               |
| `supabase-audit`        | Supabase audit RPC persistence mode with URL / anon key / session JWT placeholders.                         | No               |

Unknown profiles fail closed before output is generated.

## Generated config behavior

`generateQuorumRouterConfig(input)` returns deterministic JSON-compatible data.
It includes:

- `routing.mode`: `direct` or experimental AgentRuntime-gated `agent_chat`;
- `providers`: provider/model/auth/transport/client descriptors;
- `persistence.mode`: `none`, `localJsonl`, or `supabaseAuditRpc`;
- `telemetry.mode`: `console`, `otlp`, or `disabled`;
- `adaptiveDirect`: enabled flag, fallback label, optional budget, and optional
  readiness hints;
- setup warnings and non-goals.

Invalid provider/auth/transport combinations fail closed against the provider
capability registry. Local model selections are only placeholders and must use
`provider=Local`, `authMode=local`, and `transport=localModel`.

## Env guidance and secrets

The generator never writes raw secrets into config output.
`generateEnvExample()` prints empty assignments only, for example:

```bash
OPENAI_API_KEY=
QUORUM_ROUTER_SUPABASE_URL=
QUORUM_ROUTER_SUPABASE_ANON_KEY=
QUORUM_ROUTER_SUPABASE_SESSION_JWT=
```

Fill those values in your shell, deployment environment, or secret manager. Do
not commit filled values.

Supabase audit runtime uses anon/session credentials only. Service-role
credentials are migration/admin-only and must never be present in the router
runtime environment. `deno task doctor` continues to fail closed if a
service-role-like Supabase env var is present.

## Direct HTTP vs CLI / OAuth / session / local placeholders

- Direct HTTP profiles use provider-native API-key auth at runtime but emit only
  empty env placeholders.
- CLI profiles describe OAuth/session-backed local tools such as Codex CLI,
  Claude Code, Gemini CLI, Grok CLI, ZCode, Devin, and Cline. Setup does not run
  login flows.
- `localModel` is an optional placeholder transport for future local model work;
  it is not a runtime adapter in this PR.

## Adaptive Direct setup

The `adaptive-direct` profile enables policy config only. It keeps fallback set
to `safe_provider_unavailable_only`, includes a small deterministic budget
limit, and does not introduce hidden provider fallback behavior. Validation
mismatch, malformed responses, consensus failures, audit failures, identity
mismatches, invalid routing modes, and budget exhaustion remain fail-closed.

## Agent chat status

`agent_chat` can be represented in config only with an explicit experimental
input flag in code. It remains fail-closed by default and runs only when the
request also passes `experimentalAgentRuntime: true` and an enabled experimental
AgentRuntime config. Doctor reports a warning for selected `agent_chat`; direct
configs keep AgentRuntime disabled. AgentChat simulator is standalone and
experimental: it validates protocol roles, limits, transcript redaction, and
audit milestones without production routing, external tools, or network calls.
Setup does not enable production or live agent execution. See
[`agent-chat-protocol.md`](agent-chat-protocol.md).

## Doctor integration

`deno task doctor` reads the generated config when present and reports:

- known/unknown profile state;
- provider capability registry match;
- auth/transport match;
- Supabase anon/session-only guidance;
- service-role runtime ban;
- Adaptive Direct safe fallback configuration;
- local JSONL persistence placeholder status;
- `agent_chat` warning status.

Optional provider absence remains non-fatal. Existing expected notes remain:

- `supabase_audit_config`: `not configured`, severity `info` when Supabase env
  is absent;
- `cli_zcode`: `not found`, severity `warn` when ZCode is not installed.

## Non-goals

This PR does not implement provider account creation, OAuth login, API key
storage, live credential validation, production autonomous `agent_chat` runtime,
local JSONL audit storage, Supabase migration/RPC changes, automatic remote
health checks, hidden fallback behavior, or any change to default direct fan-out
behavior.
