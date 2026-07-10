# Dev workflow dogfood

QuorumRouter v0.1 public preview needs real development dogfood before Product
Hunt, X, or any external launch. Fixed demos prove mode separation and trace
behavior, but they do not prove usefulness on unknown development decisions.

This workflow turns ordinary development tasks into repeatable QuorumRouter
sessions with human scoring and launch impact tracking.

## Scope and non-actions

This is a dogfood workflow, not a release workflow.

- Do not post to Product Hunt.
- Do not post to X.
- Do not publish npm.
- Do not bump versions or create `0.1.4`.
- Do not mutate npm dist-tags.
- Do not move, delete, recreate, or edit v0.1.0 / v0.1.1 / v0.1.2 / v0.1.3 tags
  or releases.
- Do not run the publish workflow.
- Do not direct-push to `main`.
- Do not expose API credentials, npm tokens, passwords, or OTPs.
- Do not require secrets in CI.
- Do not commit `.env` or local dogfood outputs.

## Product boundaries to preserve

Allowed:

- Source-Available Non-Commercial; not open source.
- Best Route / direct is the production-ready best-answer routing path.
- `agent_chat` is experimental explicit opt-in only.

Reject if a session output claims or implies:

- open source without explicitly saying not open source;
- production autonomous runtime;
- live Supabase Agent Bus runtime writes;
- service-role runtime;
- Agent Chat production-ready;
- Best Route always uses Agent Chat;
- unsupported benchmark, adoption, or production readiness claims.

## Manual dev dogfood workflow

1. Pick a real development task from active work or from the dev casebook in
   `docs/dogfood/`.
2. Copy `docs/dogfood/dev-session-template.md` or run the optional local
   harness:

   ```bash
   cd examples/dev-dogfood
   deno task new-session
   ```

3. Write the task prompt into the session log.
4. Choose a mode:
   - `best_route` — compare answer paths and select the clearest, safest route.
   - `agent_chat` — use only when explicit multi-role debate/review is likely to
     add value; still experimental.
   - `human baseline` — solve manually first, then compare against QuorumRouter
     output or routing principles.
5. Run the task through QuorumRouter if available, or manually evaluate using
   QuorumRouter routing principles:
   - candidate route clarity;
   - evidence and uncertainty;
   - risk / safety boundary compliance;
   - completeness;
   - whether the output changes the user's decision.
6. Record:
   - output usefulness;
   - correctness;
   - clarity;
   - hallucination or unsupported claim;
   - safety boundary issue;
   - whether it saved time;
   - whether it changed the user's decision;
   - whether the user would use it again.
7. Classify the result:
   - useful;
   - partially useful;
   - not useful;
   - harmful / misleading.
8. Record action:
   - keep;
   - fix prompt/docs;
   - fix code;
   - known limitation;
   - public launch blocker.

## Recommended session mix before public posting

Minimum useful dogfood batch:

- at least 10 real development tasks;
- at least 3 documentation / launch copy tasks;
- at least 3 code / architecture or PR-readiness tasks;
- at least 2 routing-specific mode-selection tasks;
- at least 2 safety / claims tasks;
- at least one `human baseline` comparison;
- at least one explicit `agent_chat` opt-in session, marked experimental.

## Evidence locations

Committed docs:

- `docs/dogfood/dev-workflow-dogfood.md`
- dev casebook in `docs/dogfood/`
- `docs/dogfood/dev-session-template.md`
- `docs/dogfood/dev-go-no-go-rubric.md`
- `docs/dogfood/dev-dogfood-bug-taxonomy.md`
- `docs/dogfood/dev-dogfood-summary.md`

Local-only outputs, not committed. The reusable templates are prepared under
`out/dogfood/` during this workflow; the optional harness only creates per-task
session logs under `out/dogfood/dev-sessions/`.

- `out/dogfood/dev-session-log-template.md`
- dev results CSV template in `out/dogfood/`
- `out/dogfood/dev-go-no-go-scorecard.md`
- `out/dogfood/dev-sessions/*.md`

## Public posting remains blocked until

- at least 10 real dev tasks are evaluated; if fewer than 10 are complete, the
  only valid decision is **Needs more dogfood**;
- no P0/P1 remains open;
- the aggregate score meets the go/no-go rubric;
- all launch-blocking safety/claim issues are fixed or explicitly reclassified;
- npm latest remains `0.1.3`;
- v0.1.3 release/tag remains unchanged;
- no Product Hunt/X post, npm publish, version bump, dist-tag mutation, or
  tag/release mutation has occurred.
