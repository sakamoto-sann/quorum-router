# Internal dogfood manual QA runbook

Purpose: prepare QuorumRouter v0.1 public preview for internal manual dogfood
before Product Hunt, X, or any other external launch surface.

This runbook is verification-only. It must not publish, retag, change npm
dist-tags, create a new version, create a new repository, or post externally.

## Scope and non-actions

- Do not post to Product Hunt.
- Do not post to X.
- Do not publish npm without explicit release approval.
- Do not mutate npm dist-tags without explicit release approval.
- Do not create tags/releases during dogfood verification.
- Do not move, delete, recreate, or edit v0.1.0 / v0.1.1 / v0.1.2 / v0.1.3 /
  v0.1.4 tags or releases.
- Do not run the publish workflow.
- Do not create a new repository.
- Do not expose npm token, password, or OTP.

## Product boundaries to preserve

Allowed wording:

- QuorumRouter is **MIT**.
- QuorumRouter is **open source**.
- Best Route / direct mode is the production-ready best-answer routing path.
- `agent_chat` is experimental, explicit opt-in only.
- npm / NPX quickstart works for the published package.

Disallowed wording:

- open source, unless the sentence explicitly says it is open source;
- production autonomous runtime;
- live Supabase Agent Bus runtime writes;
- service-role runtime;
- autonomous agent swarm;
- guaranteed best answer;
- Agent Chat production-ready;
- Best Route always uses Agent Chat.

## Roles

| Role          | Responsibility                                                                                  |
| ------------- | ----------------------------------------------------------------------------------------------- |
| QA owner      | Runs this runbook, collects artifacts, and makes the initial go/no-go recommendation.           |
| Manual tester | Runs selected cases from `manual-test-matrix.md` on a real machine and records results.         |
| Reviewer      | Checks claims, README/GitHub/npm/release surfaces, and launch blockers before external posting. |

At least one non-author manual test session must pass end-to-end before public
posting.

## Recommended dogfood flow

1. Create a fresh QA session log from `manual-session-log-template.md` or
   `out/dogfood/session-log-template.md`.
2. Run the preflight/readback commands below.
3. Run repo-local local model dogfood inventory and health checks.
4. Run NPX latest and pinned install tests.
5. Run Best Route and Agent Chat demo tests.
6. Review README, npm, and GitHub release surfaces.
7. Run external provider dogfood from `external-api-dogfood.md` on a
   credentialed machine.
8. Run the claims/safety scan.
9. Classify every failure with `bug-report-template.md`.
10. Complete `go-no-go-checklist.md` and `out/dogfood/go-no-go-scorecard.md`.
11. Decide: **GO**, **NO-GO**, or **GO with known limitations**.

## Preflight / verification commands

Run from a clean shell. These commands are read-only except for local temp
directories and Deno/npm caches. The canonical internal dogfood path is
`/Users/tetsu/work/quorum-router`; testers with a different clone location can
set `QUORUM_ROUTER_REPO` before copying the commands.

```bash
export QUORUM_ROUTER_REPO="${QUORUM_ROUTER_REPO:-/Users/tetsu/work/quorum-router}"
cd "$QUORUM_ROUTER_REPO"
git status --short
git branch --show-current
git fetch --tags --prune
git rev-parse HEAD
git rev-parse origin/main
git rev-parse v0.1.4^{}
```

```bash
export QUORUM_ROUTER_REPO="${QUORUM_ROUTER_REPO:-/Users/tetsu/work/quorum-router}"
cd "$QUORUM_ROUTER_REPO/packages/create-quorum-router"
npm view create-quorum-router@0.1.4 name version license bin dist.tarball --json
npm dist-tag ls create-quorum-router
```

```bash
export QUORUM_ROUTER_REPO="${QUORUM_ROUTER_REPO:-/Users/tetsu/work/quorum-router}"
cd "$QUORUM_ROUTER_REPO/examples/local-model-dogfood"
deno task inventory
deno task auth:status
deno task health
```

Local real-model route once, manual opt-in only:

```bash
cd "$QUORUM_ROUTER_REPO/examples/local-model-dogfood"
RUN_EXTERNAL_MODEL_DOGFOOD=1 deno task route:once --prompt "Review this README for risky claims."
RUN_EXTERNAL_MODEL_DOGFOOD=1 deno task best-route --prompt "Choose the safest launch copy."
RUN_EXTERNAL_MODEL_DOGFOOD=1 RUN_EXPERIMENTAL_AGENT_CHAT=1 deno task agent-chat --prompt "Review this launch plan."
```

NPX latest fixture smoke:

```bash
tmp="$(mktemp -d)"
cd "$tmp"
npx --yes create-quorum-router@latest my-quorum-router-demo
cd my-quorum-router-demo
deno task check
deno task smoke
```

Generated scaffold intake/onboarding, no provider generation request:

```bash
tmp="$(mktemp -d)"
cd "$tmp"
npx --yes create-quorum-router@latest my-quorum-router-demo
cd my-quorum-router-demo
deno task intake
deno task auth:status
deno task models:list
deno task health
```

Expected on an uncredentialed machine: a safe blocked/no-provider recommendation
that prints no credential values. That is safe but does not satisfy the public
launch gate.

Generated once-only run on a credentialed machine:

```bash
cd my-quorum-router-demo
RUN_EXTERNAL_MODEL_DOGFOOD=1 deno task route:once --prompt "Review this README for risky claims."
```

Generated Best Route run on a credentialed machine:

```bash
cd my-quorum-router-demo
RUN_EXTERNAL_MODEL_DOGFOOD=1 deno task best-route --prompt "Compare direct fix vs refactor."
```

This must write `out/route-once-trace.json` or `out/best-route-trace.json`
without provider credential values. It is manual opt-in only and must not run in
CI.

Best Route demo:

```bash
export QUORUM_ROUTER_REPO="${QUORUM_ROUTER_REPO:-/Users/tetsu/work/quorum-router}"
cd "$QUORUM_ROUTER_REPO/examples/best-route-game"
deno task demo
```

Agent Chat demo:

```bash
export QUORUM_ROUTER_REPO="${QUORUM_ROUTER_REPO:-/Users/tetsu/work/quorum-router}"
cd "$QUORUM_ROUTER_REPO/examples/agent-chat-game"
deno task demo
```

## What to capture

For each manual tester and each case:

- OS and version.
- Shell.
- Node version.
- npm version.
- Deno version.
- Command or action run.
- Expected result.
- Actual result.
- Time to success.
- Confusion points.
- Error messages.
- Screenshot/GIF if useful.
- Pass/fail.
- Severity if failed.

## Evidence paths

Committed docs:

- `docs/dogfood/manual-qa-runbook.md`
- `docs/dogfood/manual-test-matrix.md`
- `docs/dogfood/bug-report-template.md`
- `docs/dogfood/go-no-go-checklist.md`
- `docs/dogfood/manual-session-log-template.md`
- `docs/dogfood/known-limitations.md`
- `docs/dogfood/internal-dogfood-summary.md`

Local-only templates, not committed unless explicitly approved:

- `out/dogfood/session-log-template.md`
- `out/dogfood/manual-test-results-template.csv`
- `out/dogfood/go-no-go-scorecard.md`

## Before public posting

Public posting is blocked until:

- all must-pass items in `go-no-go-checklist.md` pass;
- at least one non-author manual test session passes end-to-end;
- no P0/P1 dogfood bugs remain open;
- no visible surface makes a disallowed claim;
- at least one real external provider dogfood pass is reviewed;
- npm latest points to an approved external-dogfood package version after
  publish approval;
- v0.1.4 tag/release remains unchanged;
- no npm publish or dist-tag mutation was attempted during dogfood.
