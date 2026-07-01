# Foundation module layout

This repository keeps `router.ts` as the public compatibility entrypoint, but
the implementation now lives under `src/` so future provider registry,
installer, `agent_chat`, and persistence work can proceed in parallel without
editing one large file.

## Public compatibility contract

Existing imports from `./router.ts` remain supported. The root file is now a
barrel that re-exports the public contracts from the split modules, including:

- `FusionRouter`
- `RouterError` and `ProcessExecutionError`
- routing-mode parser / resolver / decision helpers
- config loader exports
- process and direct-HTTP adapter factories
- telemetry and audit sink factories
- schemas and exported types
- runtime helper exports used by the CLI smoke path

A public-export smoke test imports `./router.ts` and verifies the core runtime
exports are still present.

## Current layout

```text
router.ts                         # public compatibility barrel + CLI entrypoint
src/
  router.ts                       # FusionRouter core route/telemetry flow
  routing-mode.ts                 # direct/agent_chat schema, precedence, decision summary
  config.ts                       # fusion-router.config.json loader
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
- `agent_chat` is recognized but not implemented and fails closed before adapter
  execution
- routing decision details are bounded to sanitized
  `{ mode, source, implemented }`
- audit sinks remain must-accept / fail-closed
- telemetry sinks remain best-effort / drop-oldest
- Supabase service-role credentials remain forbidden at runtime
- Supabase audit RPC payload shape is unchanged
- `BufferedBatchSink` delivery semantics are unchanged

## Doctor setup checks

`deno task doctor` now delegates to `src/doctor/checks.ts` and reports routing
setup state without exposing raw config contents or invalid env values. The new
routing checks cover:

- default config path absent / present / valid / invalid
- `FUSION_ROUTER_MODE` absent / valid / invalid
- config-vs-env precedence note
- effective routing decision and implementation status
- explicit note that `agent_chat` is recognized but not implemented
- direct-mode readiness summary

The existing operational checks remain in place: Deno version, direct HTTP
state, OTLP endpoint masking, Supabase audit config, Supabase service-role ban,
CLI availability, and telemetry buffer limits.

## Non-goals for this foundation wave

This layout does not add:

- `agent_chat` runtime
- planner / coder / reviewer / red-team / closeout execution
- agmsg protocol
- provider capability registry
- fallback policy engine
- installer wizard
- local JSONL audit store
- Supabase migration changes
- Supabase audit RPC payload changes
- audit fail-closed semantic changes
- telemetry delivery semantic changes
