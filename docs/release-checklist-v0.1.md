# v0.1.1 AgentRuntime Release Checklist

Use this checklist for the experimental AgentRuntime PR and release closeout. Do
not retarget the existing v0.1.0 tag/release silently; v0.1.1 is the first real
AgentRuntime threshold.

## Local verification

- [ ] `deno task fmt`
- [ ] `deno task lock:check`
- [ ] `deno task check`
- [ ] `deno task lint`
- [ ] `deno task test`
- [ ] `deno task doctor`
- [ ] `deno task smoke:v0.1`
- [ ] `gitleaks git --log-opts "$(git merge-base origin/main HEAD)..HEAD" --redact --no-banner`

## Expected local results

- [ ] Tests pass with the expected count for the branch.
- [ ] `smoke:v0.1` passes and includes AgentRuntime success:
      `"agentRuntime": { "ok": true, "decision": "ready", "turns": 5 }`.
- [ ] Doctor reports `ok: true`.
- [ ] `supabase_audit_config`: `not configured`, severity `info`.
- [ ] `cli_zcode`: `not found`, severity `warn`.
- [ ] Gitleaks reports no leaks found.

## Runtime gates

- [ ] `direct` remains production-ready best-answer routing.
- [ ] `agent_chat` without `experimentalAgentRuntime: true` fails closed before
      adapter execution.
- [ ] `agent_chat` with missing/disabled/non-experimental runtime config fails
      closed before adapter execution.
- [ ] Required runtime roles are present exactly once:
      commander/coder/reviewer/red_team/closeout.
- [ ] Runtime returns transcript, Agent Bus messages, Agent Bus events, closeout
      decision, final answer, and runtime summary.
- [ ] Max turns, timeout, and budget are enforced.
- [ ] Malformed role output, unsafe objections, missing role, duplicate role,
      and adapter exceptions fail closed.
- [ ] No hidden fallback behavior.

## Runtime non-goals

- [ ] No live Supabase Agent Bus runtime client/writes.
- [ ] No Supabase Realtime subscriber.
- [ ] No Edge Function gateway.
- [ ] No worker process spawning.
- [ ] No service-role runtime.
- [ ] No OAuth/API-key setup.
- [ ] No external tool execution by agents.

## CI and license

- [ ] `LICENSE` exists and declares Source-Available Non-Commercial terms.
- [ ] MIT license was replaced before the first AgentRuntime release.
- [ ] Current license is Source-Available Non-Commercial.
- [ ] This is not an open source license.
- [ ] Personal, academic, non-commercial evaluation and non-production testing
      are allowed.
- [ ] Commercial, production, hosted-service/SaaS/API, redistribution,
      sublicensing, integration, or derivative commercialization requires prior
      written permission.
- [ ] GitHub Actions workflow `.github/workflows/ci.yml` runs `deno-checks` and
      `optional-secret-scan` jobs on pull requests and pushes to `main`.
- [ ] `deno-checks` runs lock, check, lint, test, doctor, and v0.1 smoke.
- [ ] CI secret scan behavior is explicit: run `gitleaks` when installed, print
      a skip message when unavailable.
- [ ] Local release verification still requires the gitleaks range scan.

## PR review and GitHub state

- [ ] No unresolved review threads.
- [ ] GitHub checks pass if present.
- [ ] If GitHub checks are not reported, state that exactly; do not claim pass.
- [ ] PR is mergeable / clean before merge.

## Merge closeout

- [ ] Squash merge the PR.
- [ ] Pull `main` with `git pull --ff-only origin main`.
- [ ] Re-run release verification on `main`.
- [ ] Confirm local `main` HEAD equals `origin/main` HEAD.
- [ ] Confirm worktree clean.
- [ ] Confirm feature branch deleted after merge.
