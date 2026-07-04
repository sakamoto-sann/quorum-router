# Dev task casebook

Use these realistic development tasks for dogfooding Fusion Router on work where
answers are not known in advance. Each task should produce a session log and a
score using `dev-go-no-go-rubric.md`.

## A. Documentation / launch copy

| Case ID | Task                                                | Suggested mode              | Expected value                                                                 | What to record                                               | Pass/fail criteria                                                                                                 |
| ------- | --------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| DOC-001 | Check README for overclaiming before public launch. | best_route                  | Finds unsafe or unsupported claims while preserving concise wording.           | Claims flagged, rationale, suggested wording, safety impact. | Pass if it catches false open-source/runtime claims and does not invent new claims.                                |
| DOC-002 | Shorten release notes without losing non-goals.     | best_route                  | Produces shorter copy that keeps license/runtime boundaries.                   | Before/after length, lost details, boundary preservation.    | Pass if shorter and still says Source-Available Non-Commercial, not open source, no production autonomous runtime. |
| DOC-003 | Compare Product Hunt tagline options.               | human baseline + best_route | Ranks taglines by clarity, risk, and accuracy.                                 | Options, ranking, rejected unsafe phrases, final choice.     | Pass if it avoids unsupported adoption/benchmark claims and explains tradeoffs.                                    |
| DOC-004 | Review X launch thread for misleading claims.       | best_route                  | Identifies hype that could imply production Agent Chat or live runtime writes. | Flagged tweet, severity, suggested replacement.              | Pass if it catches mode confusion and unsafe runtime implications.                                                 |
| DOC-005 | Identify missing boundary wording in docs.          | best_route                  | Finds where license/runtime boundary is absent or too buried.                  | File/path, missing boundary, suggested placement.            | Pass if suggestions are specific and not overlong.                                                                 |

## B. Code / architecture review

| Case ID  | Task                                                  | Suggested mode | Expected value                                               | What to record                                             | Pass/fail criteria                                               |
| -------- | ----------------------------------------------------- | -------------- | ------------------------------------------------------------ | ---------------------------------------------------------- | ---------------------------------------------------------------- |
| CODE-001 | Compare two implementation plans for a small feature. | best_route     | Chooses lower-risk plan and names conditions for refactor.   | Plan A/B, selected plan, rejected risks, changed decision. | Pass if tradeoffs are concrete and recommendation is actionable. |
| CODE-002 | Classify a bug severity as P0/P1/P2/P3.               | best_route     | Maps impact to launch decision without exaggeration.         | Bug description, severity, rationale, launch impact.       | Pass if severity matches taxonomy and is reproducible.           |
| CODE-003 | Review a small code diff for risk.                    | best_route     | Finds regressions, missing tests, or safety boundary issues. | Diff summary, risks, required checks, false positives.     | Pass if findings are specific and not generic.                   |
| CODE-004 | Decide whether to add a test or docs-only change.     | best_route     | Separates behavior-risk changes from pure docs updates.      | Change type, test need, docs need, decision.               | Pass if test recommendation follows risk level.                  |
| CODE-005 | Identify missing fail-closed behavior.                | best_route     | Finds cases where invalid input could proceed too far.       | Boundary, invalid input, expected failure, severity.       | Pass if it names the boundary and a concrete failing condition.  |

## C. PR readiness

| Case ID | Task                                            | Suggested mode              | Expected value                                                     | What to record                                          | Pass/fail criteria                                                             |
| ------- | ----------------------------------------------- | --------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------ |
| PR-001  | Summarize a PR for merge review.                | best_route                  | Produces a concise summary tied to changed files and verification. | PR URL, summary accuracy, missing context.              | Pass if summary matches diff and does not claim unrun checks.                  |
| PR-002  | Identify merge blockers.                        | best_route                  | Separates must-fix blockers from polish.                           | CI, review threads, tests, safety findings, blockers.   | Pass if P0/P1/P2 classification is defensible.                                 |
| PR-003  | Write PR body from local verification.          | best_route                  | Creates a complete body with non-actions and evidence.             | Included sections, missing evidence, unsafe wording.    | Pass if body includes verification and forbidden non-actions.                  |
| PR-004  | Generate reviewer checklist.                    | best_route                  | Produces a checklist a reviewer can actually use.                  | Checklist length, coverage, mode/safety items.          | Pass if checklist is specific to the diff.                                     |
| PR-005  | Decide if Cubic/P2 feedback should block merge. | human baseline + best_route | Evaluates review finding validity and launch impact.               | Finding text, root cause, fix/waive decision, evidence. | Pass if valid P2s are not ignored and stale findings are not blindly accepted. |

## D. Routing-specific cases

| Case ID   | Task                                                 | Suggested mode | Expected value                                          | What to record                                        | Pass/fail criteria                                                       |
| --------- | ---------------------------------------------------- | -------------- | ------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------ |
| ROUTE-001 | Choose direct vs `agent_chat` for a given dev task.  | best_route     | Selects the simplest adequate mode.                     | Task, selected mode, reason, risk of overkill.        | Pass if routine tasks stay direct and debate-heavy tasks justify opt-in. |
| ROUTE-002 | Evaluate when `agent_chat` adds value.               | agent_chat     | Shows whether multi-role review improves outcome.       | Baseline output, role output, added value, time cost. | Pass if added value is concrete and limitations are recorded.            |
| ROUTE-003 | Detect when `agent_chat` is overkill.                | best_route     | Avoids unnecessary multi-role ceremony.                 | Task complexity, simpler route, time saved.           | Pass if recommendation favors direct when adequate.                      |
| ROUTE-004 | Compare route outputs for clarity/completeness/risk. | best_route     | Ranks two or more outputs with explicit criteria.       | Output candidates, score reasons, selected output.    | Pass if the winner is justified and safety risks are named.              |
| ROUTE-005 | Decide if fallback route should be used.             | best_route     | Identifies whether primary output is unusable or risky. | Primary failure, fallback candidate, fallback reason. | Pass if fallback is used only for clear failure or risk.                 |

## E. Safety / claims

| Case ID  | Task                                              | Suggested mode | Expected value                                                                        | What to record                                    | Pass/fail criteria                                                  |
| -------- | ------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------- |
| SAFE-001 | Detect false open-source claim.                   | best_route     | Flags any claim that omits Source-Available Non-Commercial / not open source wording. | Claim text, corrected wording, severity.          | Pass if false public-license wording is launch-blocking.            |
| SAFE-002 | Detect false production autonomous runtime claim. | best_route     | Flags production runtime overclaim.                                                   | Claim text, surface, corrected wording, severity. | Pass if it blocks public posting until fixed.                       |
| SAFE-003 | Detect false live Supabase write claim.           | best_route     | Flags claims of live runtime writes that do not exist.                                | Claim text, surface, corrected wording, severity. | Pass if it does not confuse schema/docs with live runtime behavior. |
| SAFE-004 | Detect Best Route / Agent Chat mode confusion.    | best_route     | Keeps Best Route/direct separate from experimental `agent_chat`.                      | Confusing wording, mode affected, fix.            | Pass if it blocks claims that Best Route always uses Agent Chat.    |
| SAFE-005 | Detect unsupported benchmark/adoption claims.     | best_route     | Removes unverified numbers or market claims.                                          | Claim, evidence, action.                          | Pass if unsupported claims are removed or qualified.                |

## Additional optional real tasks

Use these once the minimum 25 cases above are understood:

| Case ID  | Task                                                    | Suggested mode | Expected value                                                  | What to record                                     | Pass/fail criteria                               |
| -------- | ------------------------------------------------------- | -------------- | --------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------ |
| REAL-001 | Choose next small PR after dogfood findings.            | best_route     | Picks the highest-leverage fix without scope creep.             | Candidate fixes, priority, expected launch impact. | Pass if result is actionable and bounded.        |
| REAL-002 | Review generated code for boundary regressions.         | best_route     | Finds unsafe runtime, credential, or mode-boundary regressions. | Code path, risk, required test.                    | Pass if findings map to concrete files/tests.    |
| REAL-003 | Choose best response for a technical support question.  | best_route     | Produces accurate, concise answer and avoids overclaiming.      | Question, candidates, selected answer, caveats.    | Pass if answer is correct and bounded.           |
| REAL-004 | Summarize a failed command and propose next diagnostic. | best_route     | Gives the next command, not a vague explanation.                | Error, root-cause hypothesis, next step.           | Pass if next step is safe and evidence-seeking.  |
| REAL-005 | Compare two docs organization options.                  | best_route     | Picks the structure that helps a first-time user.               | Options, reader impact, chosen structure.          | Pass if recommendation is grounded in user flow. |
