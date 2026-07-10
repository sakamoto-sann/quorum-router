# Supabase Agent Bus

The Supabase Agent Bus is QuorumRouter's durable coordination-plane contract for
`agent_chat` / commander runtime work. The experimental AgentRuntime can use the
in-memory store interface, but this document's Supabase path is still future
live runtime work. It is **not** a replacement for the current production direct
router path.

Required boundary:

```text
direct = best-answer routing path
agent_chat = explicit opt-in experimental multi-role runtime, otherwise fail-closed
agent_bus = durable coordination/message/event plane for agent_chat
```

## Mode comparison

### direct / best-answer

- stateless or request-scoped
- `modelAdapters` + `synthesisAdapter`
- multiple model adapters may run
- quorum and validation are enforced
- synthesis adapter produces one final answer
- Adaptive Direct policy can select/reject providers
- no message bus required
- no Supabase Agent Bus required
- production-ready baseline

### agent_chat / bus-backed coordination

- stateful run
- Commander role + peer agents
- messages/events/history through an AgentBusStore contract
- in-memory store available for deterministic experimental runtime tests
- Supabase writes and Realtime worker wake-up remain future work

Commander is a role, not a fixed provider/model/client. Agent Bus may persist
future Commander-related messages and events, but it does not choose a model,
invoke a client, or execute directives in this wave.

## Config boundary

This schema wave does **not** add a routing mode. The production routing enum
remains:

```json
{
  "routing": {
    "mode": "direct"
  }
}
```

Supported routing modes remain `direct | agent_chat`. Agent Bus config lives in
a separate namespace:

```json
{
  "routing": {
    "mode": "direct"
  },
  "agentBus": {
    "enabled": false,
    "transport": "supabase",
    "realtimeWakeup": false
  }
}
```

Rules:

- `agentBus.enabled=true` documents coordination-plane intent; live Supabase
  runtime writes are still future work.
- Commander config lives under `commander` and remains role/selection metadata;
  the experimental runtime still requires explicit role adapters.
- Enabling Agent Bus does not make `agent_chat` production-ready.
- `QuorumRouter.route(..., { routingMode: "agent_chat" })` still fails closed
  before adapter execution unless `experimentalAgentRuntime: true` and an
  enabled experimental runtime config are present.

## Durable source of truth

The database is the source of truth for teams, memberships, identities, runs,
messages, and events. Message/event payloads must be redacted and sanitized
before storage. Agent Bus records are coordination state, not a command runner.

Directive messages are records only. A future host may choose to act on a
directive after its own policy and user-consent checks, but this schema wave
does not execute directives, spawn processes, run shell commands, call tools, or
perform network side effects.

Example directive records:

```json
{
  "type": "spawn_agent",
  "role": "reviewer",
  "provider": "policy-selected",
  "reason": "review requested"
}
```

```json
{
  "type": "start_monitor",
  "teamId": "team-123",
  "agentId": "agent-456"
}
```

```json
{
  "type": "missing_dependency",
  "dependency": "supabase_realtime",
  "reason": "realtime subscriber not enabled"
}
```

## Schema scope

The migration adds:

- `fusion_agent_teams`
- `fusion_agent_members`
- `fusion_agent_identities`
- `fusion_agent_runs`
- `fusion_agent_messages`
- `fusion_agent_events`

The message model is append-oriented for sends. Read state is explicit via
`read_at`. Events are append-only and are used for milestones, state changes,
and future wake-up notifications.

## RLS boundary

RLS is required on every Agent Bus table. Runtime clients use anon key + session
JWT only. Service-role runtime is forbidden. Table endpoint privileges are
explicitly revoked for `public`, `anon`, and `authenticated`; validated RPCs are
the runtime boundary, with RLS retained as defense-in-depth.

Policy summary:

- Agent Bus tables have RLS enabled and no direct runtime table privileges.
- Team members can read their team rows only through validated RPC paths or
  future explicitly-granted narrow views.
- Operators and owners can request agent identities, runs, messages, and events
  only through validated RPC paths.
- Viewers can read but not write through validated RPC paths.
- Owner/team membership policies remain declared as defense-in-depth for future
  narrow grants; this wave grants no direct runtime table privileges.
- Message sender must be an identity in the same team.
- Message recipient must be an identity in the same team when present.
- Events must be scoped to a team the caller belongs to.
- Cross-team reads/writes fail closed.

## RPC contract

The migration adds RLS-safe RPC functions:

- `fusion_agent_send_message(...) returns uuid`
- `fusion_agent_mark_message_read(...) returns boolean`
- `fusion_agent_unread_messages(...) returns setof fusion_agent_messages`
- `fusion_agent_history(...) returns setof fusion_agent_messages`
- `fusion_agent_record_event(...) returns uuid`

Each function validates team membership, team/agent/run relations, and bounded
limits. Invalid team, run, or agent relations fail closed without exposing raw
auth details.

## Realtime boundary

Realtime/Broadcast is a future wake-up layer, not the source of truth. This PR
does not add a websocket subscriber or live runtime.

Future subscriber rule:

1. Receive a wake-up notification containing only minimal routing data.
2. Fetch the message or event by id from the database.
3. Let RLS authorize the read.
4. Act only after host policy decides the directive is allowed.

RLS remains authoritative even if a notification is delivered.

## TypeScript contract

The TypeScript contract lives under `src/agent-chat/bus/` and exports:

- Agent Bus row/domain types
- send/unread/history/read/event input types
- RPC argument mappers
- `AgentBusStore`
- `InMemoryAgentBusStore`

The in-memory store is deterministic, offline, and reference-only. It performs
no network calls, file writes, process execution, or automatic worker execution.

## Non-goals

This schema wave does not implement:

- production autonomous `agent_chat` runtime
- Realtime websocket subscriber
- Edge Function gateway
- service-role runtime
- live Supabase writes in tests
- CLI agent spawn
- live/production Commander runtime execution in this schema layer
- external tool execution
- automatic dependency installation
- OAuth/API-key setup
- local JSONL audit store
- hidden fallback behavior
- default direct route behavior changes
- any new routing mode enum
