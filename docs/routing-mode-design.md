# Routing mode design

Phase 3 design pass for the fusion router routing-mode switch. This document is
the contract for future runtime work. Implementation slices 1-3 add the safe
parser/resolver boundary, config-loader skeleton, and sanitized routing decision
summary: `direct` is active on the existing router flow, and
`agent_chat` is recognized but fails closed before adapter execution because the
agent-chat runtime is intentionally not implemented yet.

## Goals

Define two routing modes before implementation:

1. `direct` — the production default, based on the current adapter fan-out,
   validation, and consensus flow.
2. `agent_chat` — an experimental opt-in mode for multi-agent collaboration and
   complex task decomposition.

The mode switch must keep the existing fail-closed posture. A mode is not a
preference hint that the router may ignore; it is a policy boundary that affects
latency, budget, audit, timeout, fallback, and observability rules.

## Non-goals

The current implementation intentionally does not add:

- agent-chat runtime;
- agmsg protocol implementation;
- installer changes;
- new providers;
- Supabase migration changes;
- runtime audit-code changes;
- `BufferedBatchSink` changes;
- service-role runtime path.

## Routing modes

### A. `direct`

`direct` is the production default.

Use it for normal request handling, security-sensitive decisions, audit-critical
decisions, and any path where predictable latency and cost are more important
than agent collaboration.

| Property       | Contract                                                                                           |
| -------------- | -------------------------------------------------------------------------------------------------- |
| Default        | Yes. Used when no explicit valid mode is selected.                                                 |
| Latency        | Low latency. Avoid extra planning/review turns.                                                    |
| Cost           | Budget-aware before execution and during adapter selection.                                        |
| Chatter        | Minimal agent chatter. The caller gets the final result, not agent dialogue.                       |
| Base flow      | Current adapter fan-out → Zod validation → validated quorum → consensus synthesis.                 |
| Failure stance | Fail-closed on invalid mode, budget denial, validation failure, and insufficient validated quorum. |
| Audit          | Supabase audit records are must-accept / fail-closed.                                              |
| Telemetry      | Co-failure telemetry remains best-effort / drop-oldest.                                            |

`direct` should treat the current router as the baseline:

```text
request
  -> select direct mode
  -> choose configured adapters within policy and budget
  -> run adapter fan-out
  -> validate adapter outputs
  -> fail closed if quorum is missing
  -> synthesize final consensus
  -> validate final synthesis
  -> emit must-accept audit + best-effort telemetry
```

`direct` is production-safe because it limits degrees of freedom. It does not
create a planner loop, does not let one model rewrite the task for another
model, and does not add collaboration steps unless the request explicitly
configures adapters that already exist in the direct fan-out path.

### B. `agent_chat`

`agent_chat` is experimental and opt-in only.

Use it for self-healing workflows, complex task decomposition, or tasks that
benefit from a planner / coder / reviewer / red-team / closeout sequence. It is
not the production default.

| Property       | Contract                                                                                                          |
| -------------- | ----------------------------------------------------------------------------------------------------------------- |
| Default        | No. Must be explicitly selected.                                                                                  |
| Latency        | Higher latency is expected. Multiple agent turns may run.                                                         |
| Cost           | Higher cost is expected. Budget caps must be stricter and visible.                                                |
| Chatter        | Agent turn history may exist, but user-facing output should still summarize decisions and evidence.               |
| Protocol       | agmsg-like protocols are future candidates, not Phase 3 implementation scope.                                     |
| Primary use    | Self-healing, decomposition, code review, red-team review, closeout synthesis.                                    |
| Failure stance | Stricter than `direct`: fail closed on budget, timeout, missing review/red-team requirements, or unsafe fallback. |
| Audit          | Mode-independent must-accept audit. Agent-chat adds more audit events, not weaker audit.                          |
| Telemetry      | Best-effort telemetry can include agent-turn metrics and failure signals.                                         |

A future `agent_chat` flow could look like:

```text
request
  -> select agent_chat mode only after explicit opt-in
  -> classify task and safety envelope
  -> planner proposes decomposition
  -> coder/executor performs bounded work
  -> reviewer checks correctness and scope
  -> red-team checks safety, blast radius, and forbidden fallbacks
  -> closeout summarizes evidence and unresolved risk
  -> final consensus is validated
  -> emit must-accept audit + best-effort telemetry
```

The router must not silently switch into `agent_chat` because a request looks
hard. Complexity is not consent. The caller must opt in through the mode
contract.

## Mode switch contract

### Allowed values

Only two mode values are valid:

```text
direct
agent_chat
```

The minimal config-file shape is now:

```json
{
  "routing": {
    "mode": "direct"
  }
}
```

The environment setting is:

```dotenv
FUSION_ROUTER_MODE=direct
FUSION_ROUTER_MODE=agent_chat
```

Invalid values fail closed before adapter execution. Examples of invalid values:
`auto`, `agent`, `chat`, `default`, empty strings passed as explicit request or
config values, malformed JSON, a config with the wrong shape, non-string
`routing.mode`, and any unknown future-looking value.

### Selection surfaces

The future implementation may support three selection surfaces plus the default:

| Surface          | Example                      | Intended owner                |
| ---------------- | ---------------------------- | ----------------------------- |
| Request metadata | `routing_mode: "agent_chat"` | Per-request caller / gateway. |
| Config file      | `routing.mode = "direct"`    | Deployment operator.          |
| Environment      | `FUSION_ROUTER_MODE=direct`  | Runtime environment.          |
| Default          | `direct`                     | Built-in safe fallback.       |

### Precedence

When runtime switching is supported, precedence is:

```text
request metadata > config file > env > default
```

Rationale:

1. Request metadata is closest to the authenticated caller and task context.
2. Config file is explicit deployment policy and easier to review than ambient
   environment.
3. Environment is useful for deployment-level defaults but should not override
   an explicit request or checked-in config.
4. Default is `direct` when no surface selects a mode.

### Explicit opt-in rule for `agent_chat`

`agent_chat` must be explicit. It can be selected by request metadata or config.
Using env-only opt-in is allowed for an experimental deployment, but production
service defaults should not rely on env-only `agent_chat` because env drift is
easy to miss.

Recommended future policy:

| Source combination                                          | Result                                                   |
| ----------------------------------------------------------- | -------------------------------------------------------- |
| no mode anywhere                                            | `direct`                                                 |
| env says `direct`                                           | `direct`                                                 |
| env says `agent_chat`, config absent                        | `agent_chat` only in explicitly experimental deployments |
| config says `direct`, env says `agent_chat`                 | `direct`                                                 |
| request metadata says `direct`, config/env say `agent_chat` | `direct`                                                 |
| request metadata says `agent_chat`                          | `agent_chat`, if caller/task policy permits it           |
| any selected value is invalid                               | fail closed before adapter execution                     |

### Request metadata policy gate

A future request metadata mode should be validated against task policy before
use. For example:

- security-sensitive decision → force or require `direct`;
- audit-critical decision → force or require `direct`;
- high-blast-radius code modification → `agent_chat` only if reviewer and
  red-team steps are enabled;
- ordinary low-risk synthesis → `direct` unless explicitly opted into
  `agent_chat`.

## Safety contract

| Rule                         | Contract                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------- |
| Production default           | `direct` is the production-safe default.                                        |
| Experimental mode            | `agent_chat` is experimental and opt-in only.                                   |
| Security-sensitive decisions | Default to `direct`. Do not auto-escalate to agent collaboration.               |
| Audit-critical decisions     | Default to `direct`. Audit remains must-accept in every mode.                   |
| Invalid mode                 | Fail closed before adapter execution.                                           |
| Budget exceeded              | Fail closed. Do not route to an unapproved cheaper path after policy denial.    |
| Validation mismatch          | Do not unsafe-fallback after model outputs fail validation.                     |
| Service-role runtime         | Still forbidden. Mode switch must not introduce a service-role runtime path.    |
| Audit records                | Mode-independent must-accept / fail-closed.                                     |
| Telemetry records            | Mode-independent best-effort / drop-oldest unless explicitly promoted to audit. |

`agent_chat` needs stricter boundaries than `direct` because it creates more
execution surface:

- stricter total timeout;
- stricter per-agent timeout;
- explicit max-turn limits;
- explicit budget ceilings per phase;
- reviewer/red-team requirements for high-blast-radius changes;
- intervention reason when stopped by timeout, budget, policy, or objection;
- no silent degradation from review-required workflows into unchecked execution.

## Budget and fallback policy

Fallback is a policy decision, not a cost-optimization trick.

A cheaper or different model may be used only if the task class and safety
policy allow it. The router must be able to explain whether fallback happened
because a provider was unavailable, a pre-execution budget guard fired, or a
task allowed a degraded model.

### Fallback allowed

Fallback may be allowed when all relevant policy gates agree:

| Case                                   | Conditions                                                                                                        |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Provider unavailable                   | The selected provider cannot run before model output exists, and the replacement is permitted for the task class. |
| Budget guard triggers before execution | The router has not yet asked a model for a substantive output, and policy permits a cheaper route.                |
| Task class allows degraded model       | The task is low-risk enough that a lower-cost or lower-capability model is acceptable.                            |

### Fallback prohibited

Fallback must be prohibited for:

| Case                                                               | Reason                                                                                                                                                                  |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Security-sensitive decision                                        | Safety policy is more important than cost recovery.                                                                                                                     |
| Audit-critical decision                                            | The audit trail must reflect a deliberate policy route, not opportunistic degradation.                                                                                  |
| Validation mismatch after model outputs                            | Failed validation is a correctness boundary. Do not ask a different model to paper over an invalid result unless the request explicitly allows a new validated attempt. |
| High-blast-radius code modification without reviewer/red-team path | Cost fallback cannot remove required review gates.                                                                                                                      |

### Mode-specific budget posture

| Mode         | Budget posture                                                                                                                                           |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `direct`     | Estimate before fan-out, enforce adapter-level budgets, fail closed when the request cannot stay inside policy.                                          |
| `agent_chat` | Estimate at planning time and per phase. Stop before execution if the whole collaboration cannot stay inside budget. Record which phase stopped and why. |

## Timeout and intervention policy

`direct` should keep the current bounded adapter execution model:

- adapter-level timeout;
- direct HTTP `AbortSignal` propagation;
- final synthesis timeout;
- fail-closed when quorum or synthesis validation is unavailable.

`agent_chat` needs additional limits:

- total collaboration timeout;
- per-agent turn timeout;
- max planner iterations;
- max reviewer/red-team loops;
- explicit human-intervention reason when the workflow stops.

Possible intervention reasons:

```text
budget_exceeded
provider_unavailable
validation_failed
timeout
reviewer_objection
redteam_objection
policy_denied
invalid_mode
```

## Observability and audit behavior

Telemetry stays best-effort. Audit stays fail-closed.

The implemented routing decision summary is safe to expose in errors, status
helpers, telemetry summaries, and future audit metadata because it contains only
bounded enum fields:

```ts
type RoutingModeDecision = {
  mode: "direct" | "agent_chat";
  source: "request" | "config" | "env" | "default";
  implemented: boolean;
};
```

It intentionally omits raw prompts, raw invalid mode values, environment values,
config-file contents, credentials, and provider outputs. Invalid mode errors
continue to include only the source, allowed modes, and sanitized type metadata.
For future durable audit rows, record `routing_mode` / `routing_mode_source` (or
metadata equivalents) from this summary rather than storing caller-provided raw
mode input.

### `direct` observability and audit fields

`direct` should record enough to answer what the router did without logging
private prompt contents by default:

| Signal              | Audit or telemetry         | Notes                                                                                   |
| ------------------- | -------------------------- | --------------------------------------------------------------------------------------- |
| route decision      | audit                      | Which mode and route policy were selected.                                              |
| selected adapters   | audit or telemetry summary | Enough to diagnose provider choice without storing raw credentials or full prompt text. |
| budget decision     | audit                      | Budget allowed/denied and cap class.                                                    |
| validation result   | audit                      | Adapter validation and final synthesis validation outcome.                              |
| final outcome       | audit                      | allow / deny / error and short reason.                                                  |
| adapter co-failures | telemetry                  | Best-effort / drop-oldest as today.                                                     |

### `agent_chat` observability and audit fields

`agent_chat` should produce more structured records because it has more stages:

| Signal                        | Audit or telemetry                                          | Notes                                                                     |
| ----------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------- |
| agent turns                   | telemetry summary, audit milestones for important decisions | Count, role, status, and bounded reason. Avoid raw transcript by default. |
| planner decision              | audit                                                       | Decomposition summary and task policy class.                              |
| reviewer objections           | audit                                                       | Objection class and whether it blocked closeout.                          |
| red-team objections           | audit                                                       | Objection class and whether it blocked closeout.                          |
| final consensus               | audit                                                       | Final validated outcome and mode.                                         |
| timeout / intervention reason | audit                                                       | Must explain why the workflow stopped.                                    |
| co-failure metrics            | telemetry                                                   | Best-effort, not a substitute for audit.                                  |

If a future agmsg-like protocol is introduced, it should feed these
observability slots rather than replacing the audit boundary. Protocol messages
are not the audit source of truth; the Supabase audit RPC remains the durable
boundary.

## Implementation status

Implemented in slices 1-3:

- routing mode parser for `direct` and `agent_chat`;
- config loader skeleton for `fusion-router.config.json` using only
  `routing.mode`;
- sanitized routing decision summary with `mode`, `source`, and `implemented`;
- default mode of `direct`;
- fail-closed handling for invalid explicit values, including explicit empty
  strings, malformed config JSON, wrong config shape, non-string config values,
  and unknown mode strings;
- selection precedence: request metadata > config file > `FUSION_ROUTER_MODE`
  > default;
- `direct` connected to the existing router flow;
- `agent_chat` recognized but not implemented, with fail-closed behavior before
  adapter execution and a sanitized decision in `RouterError.details`.

Still future work:

- agent-chat runtime;
- agmsg protocol;
- planner / coder / reviewer / red-team / closeout execution;
- audit or telemetry schema expansion beyond the current boundary;
- installer or provider changes.

## Implementation checklist for future PRs

Future implementation PRs should keep tests for:

- default mode is `direct`;
- allowed values are exactly `direct` and `agent_chat`;
- invalid mode fails closed before adapter execution;
- precedence is request metadata > config file > env > default;
- `agent_chat` requires explicit opt-in and task policy permission;
- budget denial fails closed in both modes;
- validation mismatch never falls back unsafely;
- audit records remain must-accept in both modes;
- telemetry remains best-effort in both modes;
- service-role-like Supabase env remains forbidden in runtime;
- `agent_chat` enforces stricter budget, timeout, and reviewer/red-team gates
  for high-blast-radius work.

Do not implement `agent_chat` by making `direct` more permissive. Implement it
as a separate experimental policy branch with explicit gates and separate
telemetry labels.
