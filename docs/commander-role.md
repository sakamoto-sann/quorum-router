# Commander role contract

Commander is a role, not a model. Commander is a **role**, not a model,
provider, client, or transport.

```text
commander = role
provider/model/client = implementation
```

Commander remains a role/config/selection contract. The experimental
AgentRuntime can bind a commander role adapter explicitly, but this does not add
a production Commander service, Realtime subscribers, worker spawning, external
tool execution, local model runtime, or automatic replacement of the existing
synthesis adapter.

## Mode comparison

### direct / best-answer

- Uses `modelAdapters` + the caller-provided `synthesisAdapter`.
- Optional Commander metadata can identify the synthesis / closeout role.
- Production-ready baseline.
- No Agent Bus required.
- No Commander runtime is invoked by this config contract.

### agent_chat / experimental commander role

- Commander plans the experimental in-process runtime when explicitly bound to a
  role adapter.
- Peer roles communicate through the AgentBusStore contract.
- No automatic worker spawn or Realtime subscriber is added.
- `agent_chat` still fails closed before adapter execution without explicit
  runtime opt-in.

### agent_bus / coordination plane

- Persists future Commander-related messages/events/history.
- Remains unconnected to `QuorumRouter.route()` in this PR.
- Does not execute directives, spawn workers, call tools, or invoke models.

## Config namespace

Commander config is isolated under `commander` and does not change
`routing.mode`.

Default generated configs keep it disabled:

```json
{
  "routing": { "mode": "direct" },
  "commander": {
    "enabled": false,
    "mode": "direct_synthesis",
    "selectionStrategy": "first_eligible_synthesis",
    "local": false
  }
}
```

Explicit non-local example:

```json
{
  "routing": { "mode": "direct" },
  "commander": {
    "enabled": true,
    "mode": "direct_synthesis",
    "selectionStrategy": "explicit",
    "provider": "OpenAI",
    "model": "gpt-5.5",
    "authMode": "oauth",
    "transport": "processAdapter",
    "client": "CodexCLI"
  }
}
```

Local placeholder example:

```json
{
  "routing": { "mode": "direct" },
  "commander": {
    "enabled": true,
    "mode": "direct_synthesis",
    "selectionStrategy": "explicit",
    "provider": "Local",
    "model": "local-command-model",
    "authMode": "local",
    "transport": "localModel",
    "local": true
  }
}
```

The local example is a config/contract placeholder only. No local model runtime
is implemented here.

## Selection semantics

`selectCommander()` is deterministic and makes no network calls.

Selection strategies:

- `explicit`: requires provider/model/authMode/transport/client unless it is the
  exact local placeholder shape.
- `first_eligible_synthesis`: chooses the first enabled synthesis-capable
  synthesis candidate by input order.
- `highest_capability_score`: ranks enabled synthesis-capable candidates by
  declared capability fields only, then uses a stable descriptor-key tie-break.

Non-local explicit selection must match a registered provider descriptor and, in
`direct_synthesis` mode, must support synthesis. Unknown external
provider/model/client combinations fail closed in setup/selector validation.

## Boundaries

- `direct` remains the default best-answer route.
- Existing direct routes still use the provided `synthesisAdapter`.
- Commander config does not automatically replace `synthesisAdapter`.
- `agent_chat` remains explicit opt-in experimental runtime, otherwise
  fail-closed.
- Agent Bus remains durable coordination state; live Supabase runtime writes are
  future work.
- Service-role runtime remains forbidden.
- Audit remains must-accept / fail-closed.
- Telemetry remains best-effort / drop-oldest.

## Non-goals

This wave does not implement:

- production Commander service runtime;
- production `agent_chat`;
- Realtime subscribers;
- worker spawning;
- external tool execution;
- automatic model invocation beyond existing direct routing;
- automatic replacement of `synthesisAdapter`;
- service-role runtime;
- live Supabase writes;
- OAuth/API-key setup;
- local model runtime;
- hidden fallback behavior;
- default direct-route behavior changes.
