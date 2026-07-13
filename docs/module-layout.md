# Foundation module layout

This repository keeps `router.ts` as the public compatibility entrypoint, but
the implementation now lives under `src/` so provider registry, Adaptive Direct
policy, installer, `agent_chat`, and persistence work can proceed in parallel
without editing one large file.

## Public compatibility contract

Existing imports from `./router.ts` remain supported. The root file is now a
barrel that re-exports the public contracts from the split modules, including:

- `QuorumRouter`
- `RouterError` and `ProcessExecutionError`
- routing-mode parser / resolver / decision helpers
- config loader exports
- process and direct-HTTP adapter factories
- telemetry and audit sink factories
- Adaptive Direct provider registry, direct-routing policy, and fallback policy
- setup schema / generator / dry-run CLI exports through `src/setup/index.ts`
- Commander role/config/selection contract exports through
  `src/commander/index.ts`
- AgentChat protocol / simulator and Agent Bus contract exports through
  `src/agent-chat/index.ts`
- experimental AgentRuntime exports through `src/agent-runtime/index.ts`
- advisory calibration schemas, types, and aggregation through
  `src/calibration/calibration.ts`
- schemas and exported types
- runtime helper exports used by the CLI smoke path

A public-export smoke test imports `./router.ts` and verifies the core runtime
exports are still present.

## Current layout

```text
router.ts                         # public compatibility barrel + CLI entrypoint
setup.ts                          # setup CLI entrypoint wrapper
src/
  router.ts                       # QuorumRouter core route/telemetry flow
  routing-mode.ts                 # direct/agent_chat schema, precedence, decision summary
  config.ts                       # quorum-router.config.json loader
  errors.ts                       # RouterError, ProcessExecutionError, sanitizers
  schemas.ts                      # provider/model/synthesis/telemetry schemas
  contracts.ts                    # ModelAdapter/SynthesisAdapter/TelemetrySink interfaces
  runtime.ts                      # default router wiring + smoke-run helper
  utils.ts                        # shared abort/sleep helper
  budget/
    budget.ts                     # BudgetManager, in-memory budget, circuit breaker
  telemetry/
    cofailure.ts                  # co-failure telemetry builder
    buffered-batch-sink.ts        # generic bounded buffer + OTLP/telemetry helpers
  audit/
    supabase-audit.ts             # Supabase audit RPC handler/sink
  calibration/
    calibration.ts                # pure advisory aggregation by task/source
    calibration_test.ts           # truth-boundary and metric regressions
  policy/
    provider-registry.ts          # provider/model capability metadata
    direct-routing-policy.ts      # Adaptive Direct candidate selection decision
    fallback-policy.ts            # safe fallback reason classifier skeleton
  setup/
    index.ts                       # public setup export boundary
    setup-schema.ts                # setup profiles, provider/auth/transport schema
    config-generator.ts            # deterministic config, env guidance, setup report
    cli.ts                         # dry-run setup CLI with optional --write
  commander/
    index.ts                       # public Commander export boundary
    types.ts                       # Commander role, mode, descriptor, selection result
    selector.ts                    # deterministic no-network Commander selection helper
  agent-chat/
    index.ts                       # public AgentChat + Agent Bus export boundary
    types.ts                       # roles, phases, turns, transcript, decisions, limits
    protocol.ts                    # default limits and fail-closed limit validation
    redaction.ts                   # transcript/metadata redaction helpers
    audit.ts                       # in-memory milestone taxonomy helpers
    simulator.ts                   # deterministic standalone no-network simulator
    bus/
      index.ts                     # public Agent Bus export boundary
      types.ts                     # durable coordination domain types and store interface
      supabase-contract.ts         # RPC names, row mappers, config defaults
      in-memory-agent-bus.ts       # deterministic offline reference store
  agent-runtime/
    index.ts                       # public AgentRuntime export boundary
    types.ts                       # role bindings, limits, config, result types
    parser.ts                      # strict JSON role output parser
    prompts.ts                     # deterministic role prompt builder
    runtime.ts                     # in-process experimental role loop
  adapters/
    process.ts                    # CLI/process adapters and structured synthesis
    direct-http.ts                # OpenAI/Anthropic direct HTTP adapters
  doctor/
    checks.ts                     # doctor setup checks and report builder
```

## Safety behavior preserved

The split is intended to be behavior-preserving:

- default routing mode remains `direct`
- precedence remains request > config > env > default
- invalid modes fail closed before adapter execution
- `agent_chat` fails closed before adapter execution unless explicit
  `experimentalAgentRuntime` opt-in and enabled experimental runtime config are
  present
- routing decision details are bounded to sanitized
  `{ mode, source, implemented }`
- audit sinks remain must-accept / fail-closed
- telemetry sinks remain best-effort / drop-oldest
- Supabase service-role credentials remain forbidden at runtime
- Supabase audit RPC payload shape is unchanged
- Supabase Agent Bus is a durable coordination plane for `agent_chat`; live
  Supabase runtime writes remain future work and do not replace direct
  best-answer routing
- Commander is a role/config/selection contract, not a fixed provider or model
- Commander config does not replace the caller-provided `synthesisAdapter` or
  make `agent_chat` production-ready
- `routing.mode` remains `direct | agent_chat`; no `agent_bus` routing mode is
  introduced
- Agent Bus config under `agentBus` does not connect `QuorumRouter.route()` to a
  production `agent_chat` runtime; experimental runtime requires explicit role
  adapters
- `BufferedBatchSink` delivery semantics are unchanged
  - concurrent sink calls are serialized through flush chaining to prevent flush
    / RPC storms
  - `must_accept` failures propagate to the caller and do not silently degrade
    into best-effort delivery
  - normal enqueue and overflow bookkeeping paths are O(1); normal batch
    selection and rollback/requeue/rebuild recovery paths are bounded O(N) over
    `maxQueueSize`
  - timers are unref'ed best-effort so telemetry timers do not keep the process
    alive
- Adaptive Direct is opt-in; without `directRoutingPolicy`, direct mode still
  invokes every configured adapter as before
- fallback remains policy classification, not silent fallback success
- caller-attested calibration evidence can be aggregated before direct provider
  invocation and attached to the Decision Report, but remains advisory-only and
  is not consumed by ranking, provider selection, quorum, or execution policy

## Advisory calibration boundary

[`docs/calibration.md`](calibration.md) documents both pure calibration APIs.
The legacy v1 groups caller-attested binary outcomes by task type and
provider/model source. The additive hierarchy also emits subtype and
caller-defined pattern groups, then resolves a run from pattern to subtype to
task based only on the configured sample-count threshold. Both return accuracy,
mean confidence, Brier score, signed mean calibration bias, and sample-count
status.

The module validates structure and per-call observation ID uniqueness. It does
not authenticate evaluators, bind observations to invocations, deduplicate
across calls, persist observations, or normalize model aliases. Those guarantees
belong upstream. The direct routing path may aggregate caller-supplied evidence
before invoking providers and attach the resulting report to its Decision
Report; the report never grants routing or execution authority. Generated
`route:once` and `best-route` commands provide the same optional attach-only
trace path. Agent Chat, cost-aware selection, and model-catalog ranking do not
consume calibration reports.

## Adaptive Direct policy skeleton

[`docs/adaptive-direct-routing.md`](adaptive-direct-routing.md) documents the
new policy modules. The current wave adds capability metadata,
budget-estimate-aware selection, readiness hint rejection, synthesis candidate
selection, and a safe fallback reason classifier. It does **not** implement live
provider health, installer integration, `agent_chat`, or unsafe fallback after
validation / consensus failures.

## Doctor setup checks

`deno task doctor` now delegates to `src/doctor/checks.ts` and reports routing
setup state without exposing raw config contents or invalid env values. The new
routing checks cover:

- default config path absent / present / valid / invalid
- `QUORUM_ROUTER_MODE` absent / valid / invalid
- config-vs-env precedence note
- effective routing decision and implementation status
- explicit note that `agent_chat` is gated behind experimental runtime opt-in
- direct-mode readiness summary

The existing operational checks remain in place: Deno version, direct HTTP
state, OTLP endpoint masking, Supabase audit config, Supabase service-role ban,
CLI availability, and telemetry buffer limits.

## Setup generator wave

[`docs/setup-wizard.md`](setup-wizard.md) documents the setup schema, config
generator, and dry-run CLI. This wave adds:

- deterministic built-in profiles for minimal direct, direct HTTP, CLI OAuth,
  Adaptive Direct, and Supabase audit RPC setup;
- `quorum-router.config.json` output with provider/auth/transport/routing /
  persistence / telemetry / Adaptive Direct selections;
- empty env placeholder guidance only, never raw secret values;
- doctor checks for profile, provider capability, auth/transport match, Supabase
  anon/session-only guidance, Adaptive Direct safe fallback, local JSONL
  placeholder status, and `agent_chat` warning state.

Setup remains non-interactive and offline. It does not create provider accounts,
run OAuth, store API keys, validate live credentials, implement local JSONL
persistence, implement Commander runtime, or change Supabase migrations/RPC
payloads.

## Commander role contract

[`docs/commander-role.md`](commander-role.md) documents the configurable
Commander role contract. The contract keeps the distinction explicit:

```text
commander = role
provider/model/client = implementation
```

Direct mode may use Commander metadata to identify the synthesis/closeout role,
but the production best-answer path still uses `modelAdapters` plus the provided
`synthesisAdapter`. Future `agent_chat` may use Commander as planner,
dispatcher, and closeout agent, with Agent Bus as durable coordination state.
This wave does not connect that runtime.

## AgentChat protocol and simulator skeleton

[`docs/agent-chat-protocol.md`](agent-chat-protocol.md) documents the standalone
AgentChat skeleton. This wave adds protocol roles, bounded run limits,
transcript redaction, in-memory audit milestone taxonomy, and a deterministic
simulator for planner → coder → reviewer → red-team → closeout. The simulator
performs no LLM, network, process, tool, persistence, or Supabase work and is
not connected to `QuorumRouter.route()`.

## Non-goals for this foundation wave

This original foundation layout wave did not add:

- production autonomous `agent_chat` runtime
- live planner / coder / reviewer / red-team / closeout execution
- Commander runtime execution
- agmsg protocol
- interactive installer wizard
- local JSONL audit store
- Supabase migration changes
- Supabase audit RPC payload changes
- audit fail-closed semantic changes
- telemetry delivery semantic changes
