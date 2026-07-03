# Fusion Router v0.1.1 Experimental AgentRuntime Release

v0.1.1 is the first real AgentRuntime threshold for Fusion Router. It builds on
the earlier v0.1 Safe Direct Router baseline without silently retargeting the
existing v0.1.0 tag/release. Direct remains the production-ready best-answer
routing path; `agent_chat` becomes an **explicit opt-in experimental runtime**.

## What v0.1.1 includes

- Default-compatible `FusionRouter` direct routing with fixture-friendly adapter
  and synthesis contracts.
- Provider-native direct HTTP adapter surfaces for OpenAI and Anthropic, with
  injectable fetch boundaries for tests/examples.
- Adaptive Direct policy skeleton over provider capabilities, readiness hints,
  budget estimates, and `safe_provider_unavailable_only` fallback decisions.
- Setup profiles that generate deterministic config/env guidance.
- Config loaders for file-backed, text-backed, and in-memory generated configs.
- Standalone AgentChat protocol simulator with role/limit/redaction/audit
  coverage.
- Experimental in-process AgentRuntime for `agent_chat`, gated by both runtime
  config and per-request opt-in.
- Strict role-output JSON parser and deterministic role prompts.
- Five-turn commander/coder/reviewer/red_team/closeout loop that returns
  transcript, Agent Bus messages, Agent Bus events, closeout decision, and final
  answer.
- Supabase Agent Bus schema, RLS/RPC contract, TypeScript contract, and
  deterministic in-memory reference store. Live Supabase runtime writes remain
  future work.
- Commander role/config/selection contract for configurable synthesis/closeout
  metadata and experimental runtime planning.
- Bounded telemetry and audit primitives with explicit, distinct semantics.
- v0.1/v0.1.1 offline examples and smoke test, including AgentRuntime success.
- Source-Available Non-Commercial project license, replacing MIT before the
  first AgentRuntime release.
- GitHub Actions CI jobs for Deno lock/check/lint/test/doctor/smoke and optional
  secret scanning.

## What v0.1.1 does not include

- No real `agent_chat` production runtime.
- No fully autonomous worker process spawning.
- No Supabase Realtime subscriber.
- No live Supabase Agent Bus runtime client/writes.
- No Edge Function gateway.
- No external tool execution path in examples, smoke, or AgentRuntime.
- No GitHub, Gmail, Calendar, browser, or other product connectors.
- No live provider health checks.
- No OAuth login flow or automatic API-key setup.
- No API-key storage.
- No local JSONL audit store implementation.
- No Supabase audit RPC payload changes in this wave.
- No service-role runtime.
- No hidden fallback behavior.
- No default direct route behavior change.
- No networked examples by default.

## Quickstart

Run the offline smoke:

```bash
deno task smoke:v0.1
```

Generate a minimal direct setup profile:

```bash
deno task setup -- --profile minimal-direct
```

Run the full release checks:

```bash
deno task fmt
deno task lock:check
deno task check
deno task lint
deno task test
deno task doctor
deno task smoke:v0.1
gitleaks git --log-opts "$(git merge-base origin/main HEAD)..HEAD" --redact --no-banner
```

## AgentRuntime opt-in behavior

`agent_chat` is no longer only a skeleton when all runtime gates are present.
The route runs only when:

1. `routingMode` resolves to `agent_chat`;
2. route options include `experimentalAgentRuntime: true`;
3. `FusionRouterOptions.agentRuntime` exists;
4. `agentRuntime.enabled === true`;
5. `agentRuntime.experimental === true`;
6. all required role bindings are present exactly once.

Without those gates, `agent_chat` fails closed before adapter execution. Direct
routing behavior is unchanged with or without an AgentRuntime config.

## Runtime loop

The experimental runtime is in-process and adapter-based:

```text
commander -> coder -> reviewer -> red_team -> closeout
```

The supplied role adapters must return strict JSON. Malformed JSON, missing
required role output, missing required roles, duplicate role bindings, adapter
exceptions, max-turn violations, timeout, budget exhaustion, unsafe objections,
and closeout `ready` without a final answer fail closed. There is no hidden
fallback to another role, model, tool, or provider.

Reviewer or red-team objections block closeout readiness. Closeout becomes ready
only after reviewer and red-team both pass.

## Agent Bus boundary

The runtime records messages and events through the `AgentBusStore` interface.
Tests and examples use `InMemoryAgentBusStore`. Supabase Agent Bus remains the
durable coordination-plane contract; live Supabase writes and Realtime worker
wake-up are future work.

## Examples

Offline deterministic examples:

```bash
deno run examples/basic-direct.ts
deno run examples/adaptive-direct.ts
deno run examples/setup-generated-config.ts
deno run examples/agent-runtime-basic.ts
deno run examples/agent-runtime-fail-closed.ts
```

These examples do not require `--allow-net` and do not store credentials.

## Setup profile flow

The setup generator produces a config object plus env placeholders and doctor
expectations. Generated direct configs keep AgentRuntime disabled:

```json
{
  "agentRuntime": {
    "enabled": false,
    "experimental": false,
    "transport": "inMemory"
  }
}
```

Enabling AgentRuntime config does not change `routing.mode`.
`routing.mode =
agent_chat` still requires explicit experimental runtime route
opt-in.

## Audit / telemetry guarantees

| Surface              | Semantics   | Overflow    | Failure behavior                                          |
| -------------------- | ----------- | ----------- | --------------------------------------------------------- |
| Co-failure telemetry | best-effort | drop-oldest | never block consensus                                     |
| Workflow audit       | must-accept | fail-closed | caller sees rejection if audit cannot be accepted/drained |

Telemetry timers are unref'ed best-effort. Audit remains a fail-closed boundary.
Runtime Supabase audit uses anon/session credentials only; service-role-like env
keys are forbidden and make doctor fail.

## Security boundaries

- Examples and smoke are offline and deterministic.
- Raw API keys, tokens, credentials, and bearer strings must not appear in
  examples or release docs.
- Missing optional providers are warnings/info, not fatal readiness failures.
- Service-role-like Supabase env vars are fatal in doctor.
- Direct HTTP adapters keep injectable fetch boundaries and do not require live
  calls in tests/examples.

## CI and license

MIT license was replaced before the first AgentRuntime release. Current license:
Source-Available Non-Commercial. This is not an open source license.

Personal, academic, non-commercial evaluation and non-production testing are
allowed. Commercial, production, hosted-service/SaaS/API, redistribution,
sublicensing, integration, or derivative commercialization requires prior
written permission.

The GitHub Actions `ci` workflow runs on pull requests and pushes to `main` with
two jobs:

- `deno-checks`: runs `deno task lock:check`, `deno task check`,
  `deno task lint`, `deno task test`, `deno task doctor`, and
  `deno task smoke:v0.1`.
- `optional-secret-scan`: checks out full git history and runs
  `gitleaks git --redact --no-banner` when `gitleaks` is available.

The CI secret scan is intentionally optional when the runner lacks `gitleaks`:
in that case it prints an explicit skip message. Local release verification
still requires the gitleaks range scan below to pass.

## Verification checklist

- `deno task fmt`
- `deno task lock:check`
- `deno task check`
- `deno task lint`
- `deno task test`
- `deno task doctor`
- `deno task smoke:v0.1`
- `gitleaks git --log-opts "$(git merge-base origin/main HEAD)..HEAD" --redact --no-banner`

Expected doctor notes in the default local environment:

- `supabase_audit_config`: `not configured`, severity `info`
- `cli_zcode`: `not found`, severity `warn`
