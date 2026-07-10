# Internal dogfood summary

This pack prepares QuorumRouter v0.1 public preview for manual internal dogfood
before Product Hunt/X/external posting.

## What this pack adds

| File                                          | Purpose                                                                 |
| --------------------------------------------- | ----------------------------------------------------------------------- |
| `docs/dogfood/manual-qa-runbook.md`           | Step-by-step dogfood runbook and preflight commands.                    |
| `docs/dogfood/manual-test-matrix.md`          | Required install, demo, surface, release/npm, claims, and UX cases.     |
| `docs/dogfood/bug-report-template.md`         | Standard bug report format with severity and launch decision.           |
| `docs/dogfood/go-no-go-checklist.md`          | Must-pass, should-fix, known-limitations, and final decision checklist. |
| `docs/dogfood/manual-session-log-template.md` | Per-tester manual session log table.                                    |
| `docs/dogfood/known-limitations.md`           | Accepted limitations and when they become blockers.                     |

Local-only templates are created under `out/dogfood/` for working QA notes and
scorecards. They should not be committed unless explicitly approved.

## Required coverage

- Install / NPX latest and pinned `0.1.3` tests.
- Best Route demo separation from Agent Chat.
- Agent Chat demo experimental explicit opt-in wording.
- README/GitHub/npm/release surface checks.
- Claim/safety checks for license and runtime boundaries.
- User-experience logs from manual testers.

## Launch blocker rule

Public posting remains blocked until all must-pass checks pass and at least one
non-author manual dogfood session passes end-to-end.

## Non-actions confirmed by this docs pack

- No Product Hunt post.
- No X post.
- No npm publish.
- No version bump.
- No npm dist-tag mutation.
- No GitHub tag or release mutation.
- No publish workflow run.
