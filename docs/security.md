# Fusion Router security status

Fusion Router v0.1.1 is **source-available and non-commercial**. It is **not an
open source license**. Commercial, production, hosted-service, SaaS, API,
redistribution, sublicensing, or derivative-commercialization use requires prior
written permission.

## Runtime posture

- `direct` is the production-ready best-answer routing path.
- `agent_chat` / AgentRuntime is experimental and explicit opt-in only.
- The current release is not a production autonomous runtime.
- There is no live Supabase Agent Bus runtime client/writes path.
- There is no Supabase Realtime subscriber.
- There is no service-role runtime.

## Credential and diagnostic handling

Fusion Router redacts diagnostics before surfacing process failures, telemetry
failure messages, and agent-chat transcript content. Redaction covers
configured/ambient credential values plus common credential-shaped patterns such
as bearer tokens, `sk-...`, GitHub token prefixes, JWT-like strings, credential
query parameters, authorization header-like strings, and long high-entropy
token-like strings.

Redaction is defense-in-depth, not a substitute for secret hygiene. Do not
intentionally place production credentials in prompts, adapter stdout/stderr, or
public issue/PR text.

## Process adapter risk surface

Process adapters execute explicit configured CLI adapters. They are a risk
surface because they can run local commands, inherit selected environment
variables, and exchange prompts/schemas/output through local process boundaries.
Configure only trusted adapter commands and wrapper scripts.

Temporary schema/output files used by process-backed structured synthesis are
created under secure temporary directories, use unpredictable paths, request
restrictive permissions, and are cleaned up in `finally`. File modes remain
subject to OS/filesystem behavior and host umask semantics.

## Operational caveats

- Do not expose untrusted public traffic without external rate limiting.
- Budget and circuit breaker state is currently in-memory and is not persistent
  yet.
- Use external process isolation, host hardening, and secret management for
  deployments.
- Run `deno task doctor`, `deno task smoke:v0.1`, and a secret scan before
  publishing release artifacts.

## Non-goals for v0.1.1

The current release does not implement:

- app-level rate limiting
- persistent budget database
- process sandbox/containerization
- SBOM generation
- signed releases
- dependency scanner
- Supabase live runtime adapter
- Realtime subscriber
- service-role runtime
- local model runtime implementation
