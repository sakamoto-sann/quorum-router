# Fusion Router v0.1.2

## Status

Security hardening release after the first AgentRuntime release.

## Summary

v0.1.2 includes post-v0.1.1 security hardening for diagnostics redaction,
AgentChat redaction, process-backed structured synthesis temp files, and
security posture documentation.

## What changed since v0.1.1

- Credential redaction hardening:
  - non-standard credential-bearing names
  - authorization / proxy-authorization values
  - URL/query credentials
  - `sk-...`
  - GitHub token-shaped strings
  - JWT-like strings
  - long high-entropy token-like strings
  - reduced over-redaction for normal words such as `monkey=banana`
- AgentChat redaction hardening:
  - keeps chat-specific redaction passes
  - applies opaque credential-shape redaction without duplicating full
    diagnostic sanitizer work
- Process temp file hardening:
  - per-invocation secure temp directory
  - UUID-based schema/output temp paths
  - best-effort restrictive `0600` file permissions
  - cleanup in `finally`
  - OS/filesystem/umask caveats documented
- Security documentation:
  - added `docs/security.md`
  - README links to security status page
  - explicit source-available non-commercial license posture
  - explicit runtime boundaries and operational caveats

## Runtime scope

No routing behavior changes.

- `direct` remains the production-ready best-answer routing path.
- `agent_chat` remains experimental explicit opt-in only.
- AgentRuntime remains experimental and in-process only.

## Not included

- No production autonomous runtime.
- No live Supabase Agent Bus runtime client/writes.
- No Supabase Realtime subscriber.
- No worker process spawning.
- No AgentRuntime external tool execution.
- No service-role runtime.
- No persistent budget database.
- No app-level rate limiting.
- No process sandbox/containerization.
- No SBOM or signed release.

## License

Fusion Router is Source-Available Non-Commercial.

This is not an open source license.

Commercial, production, hosted-service/SaaS/API, redistribution, sublicensing,
integration, derivative commercialization, or competing product/service use
requires prior written permission.

## Verification target

Release target commit: `56a4356e108e9d1c8530bdb4e00d4049b2efd9cf`

Expected verification:

- `deno task lock:check`
- `deno task check`
- `deno task lint`
- `deno task test`
- `deno task doctor`
- `deno task smoke:v0.1`
- `gitleaks git --log-opts "$(git merge-base origin/main HEAD)..HEAD" --redact --no-banner`

Expected results:

- tests: `205 passed | 0 failed`
- doctor: `ok: true`
- smoke:v0.1: `ok: true`
- AgentRuntime smoke:
  - `{"ok":true,"decision":"ready","turns":5}`
- gitleaks: no leaks found

## Release rule

Do not publish unless:

- main HEAD matches intended release target
- CI is green
- local full verification is green
- license readback confirms Source-Available Non-Commercial
- existing v0.1.0 and v0.1.1 are left unchanged
