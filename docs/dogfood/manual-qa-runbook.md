# Internal dogfood manual QA runbook

Purpose: prepare Fusion Router v0.1 Public RC for internal manual dogfood before
Product Hunt, X, or any other external launch surface.

This runbook is verification-only. It must not publish, retag, change npm
dist-tags, create a new version, create a new repository, or post externally.

## Scope and non-actions

- Do not post to Product Hunt.
- Do not post to X.
- Do not publish npm.
- Do not bump package versions.
- Do not create v0.1.4.
- Do not mutate npm dist-tags.
- Do not move, delete, recreate, or edit v0.1.0 / v0.1.1 / v0.1.2 / v0.1.3 tags
  or releases.
- Do not run the publish workflow.
- Do not create a new repository.
- Do not expose npm token, password, or OTP.

## Product boundaries to preserve

Allowed wording:

- Fusion Router is **Source-Available Non-Commercial**.
- Fusion Router is **not open source**.
- Best Route / direct mode is the production-ready best-answer routing path.
- `agent_chat` is experimental, explicit opt-in only.
- npm / NPX quickstart works for the published package.

Disallowed wording:

- open source, unless the sentence explicitly says it is not open source;
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
3. Run NPX latest and pinned install tests.
4. Run Best Route and Agent Chat demo tests.
5. Review README, npm, and GitHub release surfaces.
6. Run the claims/safety scan.
7. Classify every failure with `bug-report-template.md`.
8. Complete `go-no-go-checklist.md` and `out/dogfood/go-no-go-scorecard.md`.
9. Decide: **GO**, **NO-GO**, or **GO with known limitations**.

## Preflight / verification commands

Run from a clean shell. These commands are read-only except for local temp
directories and Deno/npm caches. The canonical internal dogfood path is
`/Users/tetsu/work/fusion-router`; testers with a different clone location can
set `FUSION_ROUTER_REPO` before copying the commands.

```bash
export FUSION_ROUTER_REPO="${FUSION_ROUTER_REPO:-/Users/tetsu/work/fusion-router}"
cd "$FUSION_ROUTER_REPO"
git status --short
git branch --show-current
git fetch --tags --prune
git rev-parse HEAD
git rev-parse origin/main
git rev-parse v0.1.3^{}
```

```bash
export FUSION_ROUTER_REPO="${FUSION_ROUTER_REPO:-/Users/tetsu/work/fusion-router}"
cd "$FUSION_ROUTER_REPO/packages/create-fusion-router"
npm view create-fusion-router@0.1.3 name version license bin dist.tarball --json
npm dist-tag ls create-fusion-router
```

Clean latest NPX smoke:

```bash
tmp="$(mktemp -d)"
cd "$tmp"
npx --yes create-fusion-router@latest my-fusion-router-demo
cd my-fusion-router-demo
deno task check
deno task smoke
```

Best Route demo:

```bash
export FUSION_ROUTER_REPO="${FUSION_ROUTER_REPO:-/Users/tetsu/work/fusion-router}"
cd "$FUSION_ROUTER_REPO/examples/best-route-game"
deno task demo
```

Agent Chat demo:

```bash
export FUSION_ROUTER_REPO="${FUSION_ROUTER_REPO:-/Users/tetsu/work/fusion-router}"
cd "$FUSION_ROUTER_REPO/examples/agent-chat-game"
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
- npm latest remains `0.1.3`;
- v0.1.3 tag/release remains unchanged;
- no npm publish or dist-tag mutation was attempted during dogfood.
