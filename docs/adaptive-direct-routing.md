# Adaptive Direct routing

Adaptive Direct is the safe policy skeleton for moving `direct` mode beyond a
plain all-adapter fan-out. It introduces provider capabilities, readiness hints,
budget-aware candidate selection, and an explicit fallback policy while keeping
the default runtime behavior compatible.

## Current status

This wave is intentionally small:

- `direct` remains the production-ready implemented runtime mode.
- `agent_chat` is an explicit opt-in experimental runtime and fails closed
  before adapter execution unless runtime config and per-request opt-in are
  present.
- Without an explicit `directRoutingPolicy`, `QuorumRouter` still invokes every
  configured model adapter and uses the configured synthesis adapter exactly as
  before.
- With an explicit policy hook, the router can filter direct-mode model adapters
  using capability / readiness / budget decisions. This is a skeleton for future
  runtime ranking, not a hidden fallback engine.
- Setup profiles can generate safe Adaptive Direct config and env placeholder
  guidance without changing runtime defaults.

## Capability registry

`src/policy/provider-registry.ts` defines provider capabilities keyed by the
existing public `ProviderDescriptor` shape:

- provider / model
- auth mode
- transport
- synthesis support
- structured JSON support
- optional streaming support
- optional estimated cost
- optional latency / reliability tiers
- enabled flag
- optional tags

The default registry mirrors the descriptors produced by the current process,
wrapper, and direct HTTP adapter factories. Capability entries must not invent a
different `authMode`, `transport`, or `client` for an existing adapter
descriptor. Optional `estimatedCostUsd` metadata must be finite and non-negative
so budget checks cannot be bypassed with invalid numeric values.

## Direct routing decision

`src/policy/direct-routing-policy.ts` exposes `DirectRoutingPolicy` and
`DirectRoutingDecision`.

A policy receives:

- available adapter candidates
- synthesis candidates
- optional provider registry
- optional auth / transport / circuit readiness hints
- optional `BudgetManager` snapshot source

It returns:

```ts
type DirectRoutingDecision = {
  mode: "direct";
  selectedAdapters: ProviderDescriptor[];
  rejectedAdapters: Array<{
    descriptor: ProviderDescriptor;
    reason: string;
  }>;
  synthesis: ProviderDescriptor;
  budgetEstimatedUsd?: number;
  fallbackPolicy: "disabled" | "safe_provider_unavailable_only";
};
```

Budget handling is deliberately non-mutating: the decision reads the budget
snapshot and includes an estimate, but invocation-time budget exhaustion remains
fail-closed in the adapter / budget manager path. `QuorumRouter` can receive
readiness hints and a budget manager at construction time or per `route()` call;
per-request values override constructor defaults. When a policy prunes the
candidate set, the router lowers the effective quorum to the selected executable
adapter count instead of requiring successes from adapters the policy
deliberately excluded. If policy pruning leaves no executable adapters, the
request fails closed with the direct routing decision in error details.

## Fallback policy is not silent success

`src/policy/fallback-policy.ts` defines the safe skeleton. It only allows
fallback classification for provider availability problems where no model output
has been trusted yet:

Allowed:

- provider unavailable
- auth missing
- circuit open
- timeout before model output

Not allowed:

- validation mismatch
- malformed provider response
- consensus validation failure
- invalid routing mode
- `agent_chat` runtime gate failure
- audit failure
- provider / quote / identity mismatch style failures
- budget exhaustion

A rejected or malformed response must not be turned into success by silently
trying a different provider. Validation mismatch never falls back to an unsafe
provider, and consensus validation failure remains a hard fail-closed boundary.

## Setup profile

The `adaptive-direct` setup profile emits deterministic config with
`adaptiveDirect.enabled=true`, `fallbackPolicy=safe_provider_unavailable_only`,
and an optional budget limit placeholder. It does not wire live provider health,
write secrets, or change the default direct fan-out path unless the generated
config is explicitly consumed by an application. See
[`docs/setup-wizard.md`](setup-wizard.md).

## Compatibility and future work

Adaptive Direct is currently policy plumbing plus tests and docs. Future work
can build on this by adding:

- real runtime candidate ranking
- live provider health / circuit state feeds into readiness hints
- installer integration for auth and transport readiness
- persisted provider registry overrides
- richer budget allocation across request classes

Non-goals for this wave remain unchanged: no production autonomous `agent_chat`
runtime, no interactive installer prompt, no local JSONL audit store, no
Supabase migration or RPC payload changes, no live remote health checks, no live
Supabase Agent Bus runtime writes, no automatic provider purchase / API-key
setup, and no unsafe fallback after consensus validation failure.
