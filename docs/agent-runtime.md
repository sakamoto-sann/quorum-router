# SafeLoop-backed AgentRuntime

QuorumRouter includes an explicit opt-in, bounded AgentRuntime for `agent_chat`.
Conversation-only use remains opt-in. Repository and allowlisted command
execution is production-capable only when a real SafeLoop authority, signed
policy, distinct operator approval, and confined action runner are configured.

## Runtime boundary

```text
direct = production-ready best-answer routing path
agent_chat = recognized multi-role path; fails closed unless explicitly opted in
AgentRuntime = bounded role/fix loop; mutation requires SafeLoop
Agent Bus = durable coordination/message/event contract
SafeLoopClient = sole authority for any proposed action execution
```

Default behavior is unchanged:

- `direct` remains the default and production-ready route.
- `QuorumRouter.route(..., { routingMode: "agent_chat" })` fails closed before
  adapter execution when `experimentalAgentRuntime` is not `true`.
- `agentRuntime.enabled=true` and `agentRuntime.experimental=true` are both
  required.
- A configured runtime still does not change `routing.mode`; every agent_chat
  request must opt in explicitly.

## Required config

Runtime callers provide an `AgentRuntimeConfig`:

```ts
{
  enabled: true,
  experimental: true,
  bus,
  busIds: {
    teamId: "agent-runtime-team",
    runId: "per-invocation-run-id",
    roleAgentIds,
  },
  commander,
  roles,
  limits,
}
```

Execution configuration injects one `SafeLoopClient`, repository/run-root paths,
policy version/reference, requester identity, expected artifact scope, an
external approval resolver, and a confined action runner. QuorumRouter does not
approve requests, sign policy, or implement audit/verification authority. The
CLI client submits one immutable `safeloop execute-request` request and accepts
only a strictly bound `safeloop.execution-receipt.v1` with successful artifact
and anchor verification. Write requests require a pre-issued distinct-actor
approval for the exact canonical action digest.

The production repository runner translates validated `read_file`, `write_file`,
exact-string `patch_file`, and allowlisted `run_command` proposals into a
non-shell worker argv. Its action payload is a mode-0600 temporary file outside
the repository and is removed after the SafeLoop lifecycle completes. Repository
paths are realpath-confined; traversal and symlink escapes fail closed.
Signing-key bytes are never added to prompts, action payloads, or receipts.

Required roles:

- `commander`
- `coder`
- `reviewer`
- `red_team`
- `closeout`

Missing or duplicate role bindings fail closed before adapter execution. Runtime
callers must also supply explicit per-run `busIds.teamId` and `busIds.runId` so
Agent Bus messages/events stay isolated by invocation. Role adapter descriptors
are preserved in transcript metadata after sanitization.

Generated direct configs remain disabled:

```json
{
  "agentRuntime": {
    "enabled": false,
    "experimental": false,
    "transport": "inMemory"
  }
}
```

## Five-turn loop

`runAgentRuntime()` runs a deterministic role order:

```text
commander -> coder -> reviewer -> red_team -> closeout
```

Each role returns strict JSON. The runtime records transcript turns, Agent Bus
messages, Agent Bus events, objections, closeout state, final answer, and a
summary with turns, objections, budget, and duration.

Reviewer or red-team objections block closeout readiness. Closeout can be
`ready` only when both reviewer and red-team pass.

## Role output contract

Adapters must return valid JSON:

```json
{
  "status": "pass",
  "content": "text",
  "objection": null,
  "finalAnswer": null,
  "budgetUsd": 0
}
```

Allowed statuses are:

- `plan`
- `result`
- `pass`
- `object`
- `ready`
- `not_ready`

Malformed JSON, missing required fields, negative or non-finite budget values,
unsafe objections, or closeout `ready` without `finalAnswer` fail closed. Raw
model output is parsed and redacted before transcript/message persistence.

## Agent Bus usage

The MVP runtime uses the existing Agent Bus store interface. Tests and examples
use `InMemoryAgentBusStore`.

Recorded events include:

- `agent_runtime.started`
- `agent_runtime.turn_started`
- `agent_runtime.turn_completed`
- `agent_runtime.objection_raised`
- `agent_runtime.review_passed`
- `agent_runtime.red_team_passed`
- `agent_runtime.closeout_ready`
- `agent_runtime.failed_closed`

This PR does **not** add live Supabase writes, a Supabase Realtime subscriber,
an Edge Function gateway, or worker spawning.

## Safety boundaries

- Worker execution occurs only beneath a verified SafeLoop execute-request.
- Command execution uses exact argv allowlisting and never a shell.
- QuorumRouter cannot self-approve and ignores model-provided approval claims.
- No live Supabase Agent Bus runtime client.
- No service-role runtime credentials.
- No OAuth/API-key setup.
- No local model runtime implementation.
- No hidden fallback to another role or model.
- Audit remains must-accept / fail-closed.
- Telemetry remains best-effort / drop-oldest.

## Operator approval setup

SafeLoop and QuorumRouter are separate repositories. Install SafeLoop first and
keep its operator key outside the target repository:

```bash
git clone https://github.com/clawdia-saka/safeloop.git ../safeloop
cd ../safeloop
uv sync --extra dev
mkdir -p ~/.config/safeloop/policies ~/.local/state/safeloop
openssl rand 32 > ~/.config/safeloop/operator.key
chmod 600 ~/.config/safeloop/operator.key
```

Create an unsigned execution policy JSON containing
`schema_version=safeloop.execution-policy.v1`, a fixed `policy_version`,
`policy_id`, and explicit `mutation_classes`. Sign it with the operator-only
command:

```bash
.venv/bin/safeloop sign-execution-policy \
  --input /absolute/path/to/unsigned-policy.json \
  --policy-root "$HOME/.config/safeloop/policies" \
  --output local-agent.json \
  --signing-key-file "$HOME/.config/safeloop/operator.key"
```

Create a private broker directory outside the target repository. The
QuorumRouter process needs access only to this directory, never to the operator
key or approval database. Construct the operator client and runner:

```ts
const safeloop = new SafeLoopOperatorClient({
  brokerDir: `${Deno.env.get("HOME")}/.local/state/safeloop/broker`,
  onOperatorRequired(prompt) {
    console.error("Operator review required for", prompt.actionDigest);
    console.error("request:", prompt.requestPath);
    console.error("receipt:", prompt.receiptPath);
  },
});

const actionRunner = await RepoActionRunner.create(repoRoot, {
  commandAllowlist: [
    ["deno", "task", "check"],
    ["deno", "task", "test"],
  ],
});
```

Bind them into `AgentRuntimeConfig.execution`:

```ts
execution: {
  safeloop,
  repo: repoRoot,
  runRoot,
  taskId: (action) => `agent-${action.id}`,
  runId: (_action, index) => `agent-run-${index}-${crypto.randomUUID()}`,
  policyVersion: "p1",
  policyRef: `${Deno.env.get("HOME")}/.config/safeloop/policies/local-agent.json`,
  requestedBy: "quorum-coder",

  expectedArtifactScope: ["run.json", "timeline.jsonl"],
  timeoutSeconds: 120,
  actionRunner,
}
```

Every write pauses after an immutable digest-bound request is written. In a
separate operator terminal, inspect it and run:

```bash
safeloop operator-execute \
  --request /path/printed/request.json \
  --expected-digest sha256:<printed-digest> \
  --receipt /path/printed/receipt.json \
  --approval-db "$HOME/.local/state/safeloop/approvals.sqlite3" \
  --signing-key-file "$HOME/.config/safeloop/operator.key" \
  --policy-root "$HOME/.config/safeloop/policies" \
  --approved-by human-reviewer --json
```

Only this operator process sees the signing key. It creates the approval,
executes the immutable request, verifies artifacts and audit anchor, then writes
a mode-0600 receipt. QuorumRouter can only poll and validate that receipt. Run
QuorumRouter with Deno read permissions that include the repository, run root,
and broker directory but explicitly exclude the operator key and approval DB.

The role adapters supplied by the application must return the strict role JSON
contract below. Production deployments should use trusted, non-shell adapter
commands or direct HTTP adapters with least-privilege credentials.

## Examples

Offline deterministic examples:

```bash
deno run examples/agent-runtime-basic.ts
deno run examples/agent-runtime-fail-closed.ts
```

They do not require `--allow-net` and use fake role adapters only.
