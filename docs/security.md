# QuorumRouter security status

QuorumRouter is **MIT-licensed open source**. Commercial and production use are
permitted under the MIT License.

## Runtime posture

- `direct` is the production-ready best-answer routing path.
- Conversation-only `agent_chat` / AgentRuntime is explicit opt-in.
- SafeLoop-backed AgentRuntime provides a production-capable, bounded local
  repository execution slice with signed policy, distinct approval, watched
  execution, verified artifacts, and rollback evidence.
- GitHub, DB, external API, release, policy, and credential mutations remain
  blocked.
- There is no live Supabase Agent Bus runtime client/writes path.
- There is no Supabase Realtime subscriber.
- There is no service-role runtime.

## SafeLoop execution boundary

Repository and shell mutations are submitted through one bounded
`safeloop execute-request --json` process invocation. SafeLoop remains the
policy, approval, execution-watch, artifact-verification, anchor, and audit
authority. QuorumRouter neither signs policy nor creates approval decisions.
Every write requires an externally resolved, distinct-actor approval bound to
the immutable request digest; missing or mismatched approval fails closed.

The repository action worker receives its structured payload through a mode-0600
temporary file rather than process arguments. It confines paths to the
configured repository realpath, rejects traversal and symlink escapes, uses
atomic writes, limits data and output sizes, and permits commands only by exact
argv match. The payload and SafeLoop request files are cleaned in `finally`.

## Credential and diagnostic handling

QuorumRouter redacts diagnostics before surfacing process failures, telemetry
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

## Non-goals

The current security posture does not implement:

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
