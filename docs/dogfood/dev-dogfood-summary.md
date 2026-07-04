# Dev dogfood summary

This pack extends the manual QA dogfood work with a real development workflow.
The purpose is to test whether Fusion Router helps with ordinary development
judgment, not whether a fixed demo puzzle still prints the known answer.

## Added workflow pieces

| File                                       | Purpose                                                                      |
| ------------------------------------------ | ---------------------------------------------------------------------------- |
| `docs/dogfood/dev-workflow-dogfood.md`     | End-to-end workflow for real dev dogfood sessions.                           |
| Dev casebook in `docs/dogfood/`            | Casebook with realistic docs, code, PR, routing, and safety tasks.           |
| `docs/dogfood/dev-session-template.md`     | Per-session scoring and evaluation template.                                 |
| `docs/dogfood/dev-go-no-go-rubric.md`      | Numeric scoring and aggregate go/no-go decision rules.                       |
| `docs/dogfood/dev-dogfood-bug-taxonomy.md` | P0/P1/P2/P3 taxonomy for real dev dogfood failures.                          |
| `examples/dev-dogfood/`                    | Optional local harness that creates empty session logs without calling APIs. |

Local-only working templates are created under `out/dogfood/` and are ignored by
git.

## What counts as signal

Counts:

- review of a real README/doc change;
- comparison of implementation plans;
- direct fix vs refactor decision;
- launch copy safety review;
- PR readiness and blocker review;
- severity classification;
- route-output comparison;
- technical answer selection;
- human baseline comparison.

Does not count as primary launch signal:

- fixed Three Doors Puzzle output alone;
- deterministic fixture success alone;
- npm/readme smoke alone;
- unscored impressions without session logs.

## Decision rule

- **Strong GO**: average >= 4.2, at least 10 real dev tasks, no P0/P1.
- **GO with known limitations**: average >= 3.6, at least 10 real dev tasks, no
  P0/P1.
- **NO-GO**: any P0/P1, or average < 3.6 after enough tasks.
- **Needs more dogfood**: fewer than 10 real dev tasks tested.

## Non-actions preserved

- No Product Hunt post.
- No X post.
- No npm publish.
- No version bump.
- No npm dist-tag mutation.
- No tag/release mutation.
- No publish workflow run.
- No local dogfood outputs committed.
