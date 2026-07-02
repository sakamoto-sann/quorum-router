# AgentChat protocol and simulator skeleton

This wave defines a safe `agent_chat` protocol skeleton and deterministic
standalone simulator. The Supabase Agent Bus schema wave adds a durable
coordination/message/event contract for future `agent_chat` runs. Neither wave
connects `agent_chat` to production routing.
`FusionRouter.route(..., { routingMode: "agent_chat" })` remains recognized but
not implemented and fails closed before adapter execution.

Routing boundary:

```text
direct = best-answer routing path
agent_chat = future multi-agent chat/coordination path
agent_bus = durable coordination/message/event plane for agent_chat
commander = future planner/dispatcher/closeout role, not a fixed model
```

Commander is a role, not a provider/model/client. In direct mode, Commander
metadata can identify the selected synthesis/closeout role while the router
still uses the caller-provided `synthesisAdapter`. In future `agent_chat`,
Commander may become the planner/dispatcher/closeout agent. This protocol wave
does not connect that runtime.

## Roles and phases

The skeleton uses five fixed roles:

| Role       | Phase      | Responsibility in the simulator          |
| ---------- | ---------- | ---------------------------------------- |
| `planner`  | `planning` | scope, safety limits, verification gates |
| `coder`    | `coding`   | scripted implementation summary          |
| `reviewer` | `review`   | deterministic review pass or objection   |
| `red_team` | `red_team` | deterministic safety pass or objection   |
| `closeout` | `closeout` | final readiness summary                  |

All transcript records are redacted before being surfaced. Message, turn,
objection, closeout, and decision metadata is sanitized to primitive values
only. Credential-like metadata keys are replaced with `[REDACTED]`.

## Safety limits

`AgentChatLimits` bounds the simulator:

```ts
type AgentChatLimits = {
  maxTurns: number;
  maxTurnsPerRole: Partial<Record<AgentChatRole, number>>;
  maxDurationMs: number;
  maxPhaseDurationMs: number;
  maxBudgetUsd?: number;
};
```

Defaults are deliberately small and offline-only. Invalid limits fail closed
with a structured `RouterError`; runtime limit overruns also fail closed. The
simulator has no unbounded loop, no network requirement, and no external side
effects.

## Redaction behavior

`redactAgentChatContent()` and `sanitizeAgentChatMetadata()` redact:

- credential-like key names;
- bearer/API-key/session/token/password/secret key-value patterns;
- JSON-style sensitive fields;
- known extra values passed by the caller.

The goal is to preserve enough text for debugging while preventing transcript
surfaces from leaking raw credentials.

## Audit milestone taxonomy

This PR defines taxonomy plus an in-memory test helper. Supabase Agent Bus adds
separate message/event tables for future coordination, while the existing
Supabase audit RPC payload remains unchanged.

Milestones:

- `agent_chat.started`
- `agent_chat.phase_started`
- `agent_chat.turn_recorded`
- `agent_chat.objection_raised`
- `agent_chat.review_passed`
- `agent_chat.red_team_passed`
- `agent_chat.closeout_ready`
- `agent_chat.failed_closed`

## Simulator behavior

`runAgentChatSimulator()` is deterministic and uses scripted role outputs. The
default flow is:

```text
planner → coder → reviewer → red_team → closeout
```

No real LLM calls are made. No process, network, tool, GitHub, Gmail, Calendar,
Supabase, or persistence side effects are performed.

If reviewer or red-team raises an objection, the final decision is `not_ready`
and `closeout.ready` is false. Closeout is ready only when review and red-team
both pass.

Example:

```bash
deno run examples/agent-chat-simulator.ts
```

## Router integration boundary

This skeleton is intentionally exported for standalone experimentation, but it
is not connected to `FusionRouter.route()`.

Preserved behavior:

- `direct` remains the default runtime route.
- `agent_chat` remains recognized but not implemented.
- `agent_chat` route execution fails closed before adapter execution.
- Commander config does not invoke a model, spawn workers, or replace
  `synthesisAdapter`.
- audit remains must-accept / fail-closed.
- telemetry remains best-effort / drop-oldest.
- service-role runtime credentials remain banned.

## BufferedBatchSink reference note

BufferedBatchSink uses O(1) normal enqueue and overflow bookkeeping paths.
Normal batch selection and rollback/requeue/rebuild recovery paths are bounded
O(N) over `maxQueueSize`; recovery paths are only used for failure handling.
Concurrent sink calls are serialized through flush chaining, preventing
flush/RPC storms. `must_accept` failures propagate to the caller and do not
silently degrade into best-effort delivery. Timers are unref'ed best-effort so
telemetry timers do not keep the process alive.

## Non-goals

This wave does not implement:

- real `agent_chat` runtime;
- real planner/coder/reviewer/red-team LLM calls;
- production Commander runtime;
- external tool execution;
- GitHub/Gmail/Calendar connectors;
- network calls;
- Supabase audit RPC payload changes;
- production Agent Bus runtime connection;
- local JSONL audit store;
- hidden fallback behavior;
- default direct-route behavior changes;
- production-ready agent orchestration.
