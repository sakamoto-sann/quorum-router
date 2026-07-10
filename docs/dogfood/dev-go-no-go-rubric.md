# Dev dogfood go/no-go rubric

Use this rubric after scoring real development tasks with
`dev-session-template.md`. Fixed puzzle demos do not count as real dev tasks for
this rubric.

## Per-task scoring

Score each metric from 1 to 5.

| Score | Meaning                                                         |
| ----: | --------------------------------------------------------------- |
|     1 | Harmful, misleading, unsafe, or unusable.                       |
|     2 | Mostly not useful; requires substantial human correction.       |
|     3 | Partially useful; saves some thinking but has important gaps.   |
|     4 | Useful; mostly correct, clear, and safe with minor edits.       |
|     5 | Strongly useful; materially improves speed or decision quality. |

Metrics:

| Metric                     | What to evaluate                                                    |
| -------------------------- | ------------------------------------------------------------------- |
| Usefulness                 | Did it help solve the real development task?                        |
| Correctness                | Was the output factually and technically correct?                   |
| Clarity                    | Was the output easy to act on?                                      |
| Safety/boundary compliance | Did it avoid unsafe claims, secrets, and runtime/license confusion? |
| Time saved                 | Did it reduce work versus the human baseline?                       |
| Decision impact            | Did it change or confirm the user's decision in a valuable way?     |
| Would use again            | Would the tester use QuorumRouter for a similar task?               |

Task score = average of the seven metric scores.

## Aggregate scoring

Aggregate score = average task score across real dev tasks.

| Decision                  | Criteria                                                         |
| ------------------------- | ---------------------------------------------------------------- |
| Strong GO                 | Average >= 4.2, at least 10 real dev tasks tested, and no P0/P1. |
| GO with known limitations | Average >= 3.6, at least 10 real dev tasks tested, and no P0/P1. |
| NO-GO                     | Any P0/P1, or average < 3.6 after enough real tasks.             |
| Needs more dogfood        | Fewer than 10 real dev tasks tested.                             |

## Severity override

Any P0 or P1 overrides the numeric average and blocks public posting until fixed
or explicitly reclassified with evidence.

P2 issues should normally be fixed before public posting unless accepted as
known limitations. P3 issues can ship if they do not affect safety, correctness,
or mode boundaries.

## Minimum evidence before public posting

- At least 10 real dev tasks tested.
- At least one human-baseline comparison.
- At least one explicit `agent_chat` opt-in session, marked experimental.
- No unresolved public launch blockers.
- No unguarded disallowed claim in README/docs/launch surfaces.
- npm latest still `0.1.3` and v0.1.3 release/tag unchanged.
