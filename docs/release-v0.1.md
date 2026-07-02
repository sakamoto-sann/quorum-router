# Fusion Router v0.1 Safe Direct Router Release

v0.1 packages the merged foundation, Adaptive Direct, setup, and AgentChat
skeleton waves into a conservative **Safe Direct Router** baseline. The release
is intentionally integration-heavy: examples, smoke coverage, setup-to-runtime
wiring, and release verification are the deliverables. It does not add new live
runtime capabilities.

## What v0.1 includes

- Default-compatible `FusionRouter` direct routing with fixture-friendly adapter
  and synthesis contracts.
- Provider-native direct HTTP adapter surfaces for OpenAI and Anthropic, with
  injectable fetch boundaries for tests/examples.
- Adaptive Direct policy skeleton over provider capabilities, readiness hints,
  budget estimates, and `safe_provider_unavailable_only` fallback decisions.
- Setup profiles that generate deterministic config/env guidance.
- Config loaders for file-backed, text-backed, and in-memory generated configs.
- Standalone AgentChat protocol simulator with role/limit/redaction/audit
  skeletons.
- Bounded telemetry and audit primitives with explicit, distinct semantics.
- v0.1 offline examples and smoke test.

## What v0.1 does not include

- No real `agent_chat` production runtime.
- No planner/coder/reviewer LLM calls.
- No external tool execution path in examples or smoke.
- No GitHub, Gmail, Calendar, or other product connectors.
- No live provider health checks.
- No OAuth login flow or automatic API-key setup.
- No API-key storage.
- No local JSONL audit store implementation.
- No Supabase migration changes in this wave.
- No Supabase audit RPC payload changes in this wave.
- No hidden fallback behavior.
- No default direct route behavior change.
- No networked examples by default.

## Quickstart

Run the v0.1 offline smoke:

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

## Setup profile flow

The setup generator produces a config object plus env placeholders and doctor
expectations. v0.1 supports loading that generated object directly via
`loadFusionRouterConfigValue()` or from JSON text via
`loadFusionRouterConfigText()`. File loading remains available with
`loadFusionRouterConfig(path)`.

The `minimal-direct` profile is the safest starter: no providers, no
persistence, console telemetry, and direct routing.

## Basic direct example

[`examples/basic-direct.ts`](../examples/basic-direct.ts) constructs a router
from deterministic fixture adapters and returns a validated synthesis. It
performs no network calls, process execution, credential reads, or writes.

```bash
deno run examples/basic-direct.ts
```

## Adaptive Direct safe skeleton

[`examples/adaptive-direct.ts`](../examples/adaptive-direct.ts) demonstrates a
provider registry, capability policy, selected candidates, rejected candidates,
and selected synthesis lane. It uses fixture descriptors and readiness hints,
not live provider probing.

Adaptive Direct remains conservative:

- policy decisions are explicit;
- rejected candidates include reasons;
- fallback policy is `safe_provider_unavailable_only`;
- no hidden fallback turns a failed request into a fake success.

## Setup-generated config example

[`examples/setup-generated-config.ts`](../examples/setup-generated-config.ts)
generates `minimal-direct`, loads it through the runtime config boundary, and
passes the resolved routing mode into a fixture `FusionRouter`.

## AgentChat simulator boundary

`agent_chat` is recognized by schemas and setup, but production route execution
still fails closed before adapter execution. The only executable AgentChat path
in v0.1 is the standalone deterministic simulator in
[`examples/agent-chat-simulator.ts`](../examples/agent-chat-simulator.ts) and
the v0.1 smoke test.

Required invariant:

```ts
await router.route("...", { routingMode: "agent_chat" }); // RouterError 4401
```

No adapter should be called on that path.

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

## Known limitations

- `agent_chat` has no runtime integration.
- Adaptive Direct is a selection policy skeleton, not a live health checker.
- Setup profiles generate guidance/config only; they do not log into providers
  or store credentials.
- Supabase audit persistence requires external project setup and is not
  exercised by offline smoke.
- Google/xAI direct HTTP lanes remain follow-up work.

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
