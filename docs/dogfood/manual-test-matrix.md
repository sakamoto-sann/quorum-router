# Manual test matrix

Use this matrix to select and record internal dogfood cases before public
posting. Each case should be copied into a session log row and marked pass/fail
with evidence.

Severity guidance:

- P0: launch blocker, stop public posting.
- P1: must fix before public posting.
- P2: should fix before public posting.
- P3: polish or follow-up.

## A. Install / NPX tests

| Case ID | Case                                     | Steps                                                                                                                                                              | Expected result                                                                                                           | Failure severity |
| ------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| A1      | Clean temp install with latest           | `tmp="$(mktemp -d)"`; `cd "$tmp"`; `npx --yes create-quorum-router@latest my-quorum-router-demo`; `cd my-quorum-router-demo`; `deno task check`; `deno task smoke` | Scaffold succeeds; generated demo checks and smokes successfully; no credentials required; no secret-like values printed. | P0/P1            |
| A2      | Clean temp install with pinned version   | `tmp="$(mktemp -d)"`; `cd "$tmp"`; `npx --yes create-quorum-router@0.1.4 my-quorum-router-demo`; `cd my-quorum-router-demo`; `deno task check`; `deno task smoke`  | Same as A1, using the pinned package.                                                                                     | P0/P1            |
| A3      | Non-empty directory behavior             | Create a non-empty target directory, run the scaffold into it, then retry with `--force` only if intentionally testing overwrite behavior.                         | Default run refuses or safely stops; no files are overwritten unexpectedly; `--force` behavior is explicit.               | P1               |
| A4      | Invalid project name: spaces             | Try a target with spaces, such as `"bad name"`.                                                                                                                    | Failure is understandable and does not create confusing partial output.                                                   | P2               |
| A5      | Invalid project name: special characters | Try names with shell-safe special characters such as `bad@name` or `bad:name`.                                                                                     | Failure is understandable or name normalization is clearly documented; no unexpected overwrite.                           | P2               |
| A6      | Invalid target: existing file path       | Create a file and pass that file path as the target.                                                                                                               | Scaffold refuses clearly and does not replace the file.                                                                   | P1               |
| A7      | Nested path behavior                     | Try a nested path such as `tmp/nested/my-quorum-router-demo`.                                                                                                      | Either creates the nested project safely or fails with clear parent-directory guidance.                                   | P2               |
| A8      | Re-run behavior                          | Run the scaffold once, then run it again with the same target.                                                                                                     | Safe failure by default or explicit `--force` requirement; no silent overwrite.                                           | P1               |
| A9      | Network failure observation              | Temporarily block or simulate failure reaching `raw.githubusercontent.com`, then run scaffold or smoke.                                                            | Error explains the network dependency; no credentials or secrets are printed. Record exact message.                       | P2               |
| A10     | Deno missing note                        | On a machine without Deno, or by temporarily moving Deno off `PATH`, run generated checks/smoke.                                                                   | Failure points to installing/upgrading Deno and is understandable to a first-time user.                                   | P2               |
| A11     | Old Deno note                            | If available, run generated checks/smoke with an older Deno version.                                                                                               | Failure is understandable; record version and message. If not available, mark not tested.                                 | P2               |

## B. Best Route mode tests

Command:

```bash
export QUORUM_ROUTER_REPO="${QUORUM_ROUTER_REPO:-/Users/tetsu/work/quorum-router}"
cd "$QUORUM_ROUTER_REPO/examples/best-route-game"
deno task demo
```

| Case ID | Case                      | Must verify                                                                            | Failure severity |
| ------- | ------------------------- | -------------------------------------------------------------------------------------- | ---------------- |
| B1      | Mode banner               | Output clearly says `Mode: best_route`.                                                | P1               |
| B2      | Route comparison          | Output shows route comparison / score table.                                           | P1               |
| B3      | Fixture agent labels      | Output shows `Fixture agents: Grok vs GLM` and does not imply live Grok/GLM API calls. | P1               |
| B4      | Selected route            | Output shows the selected route as `balanced_development` below `Selected route:`.     | P1               |
| B5      | Next move                 | Output shows `Next move:` followed by `Grok ▲S-68`.                                    | P1               |
| B6      | Fadeout excerpt           | Output shows `Fadeout preview:` and does not pretend to show a full match.             | P1               |
| B7      | No Agent Chat roles       | Output does not show `Mode: agent_chat` or role-conversation framing.                  | P1               |
| B8      | No Agent Chat implication | Output does not imply Best Route invokes Agent Chat.                                   | P1               |
| B9      | Trace file exists         | Trace JSON exists after the run. Record path.                                          | P1               |
| B10     | Trace JSON valid          | Trace JSON parses as valid JSON.                                                       | P1               |
| B11     | Offline/no credentials    | Demo requires no network/API call and no credentials.                                  | P1               |
| B12     | Shogi variation           | Change shogi excerpt input if supported; otherwise mark not supported.                 | P2               |
| B13     | Repeated run determinism  | Run repeatedly and compare meaningful output.                                          | P2               |

## C. Agent Chat Game mode tests

Command:

```bash
export QUORUM_ROUTER_REPO="${QUORUM_ROUTER_REPO:-/Users/tetsu/work/quorum-router}"
cd "$QUORUM_ROUTER_REPO/examples/agent-chat-game"
deno task demo
```

| Case ID | Case                            | Must verify                                                                            | Failure severity |
| ------- | ------------------------------- | -------------------------------------------------------------------------------------- | ---------------- |
| C1      | Mode banner                     | Output clearly says `Mode: agent_chat`.                                                | P1               |
| C2      | Experimental wording            | Output says experimental explicit opt-in.                                              | P1               |
| C3      | Fixture agent labels            | Output shows `Fixture agents: Grok vs GLM` and does not imply live Grok/GLM API calls. | P1               |
| C4      | Partial match                   | Output shows `Partial match:` with alternating Grok and GLM turns.                     | P1               |
| C5      | Grok turn                       | Output shows `1. Grok:`.                                                               | P1               |
| C6      | GLM turn                        | Output shows `1... GLM:`.                                                              | P1               |
| C7      | Fadeout excerpt                 | Output shows `Fadeout:` and does not pretend to show a full match.                     | P1               |
| C8      | No Best Route table             | Output does not show the Best Route score table.                                       | P1               |
| C9      | No production-ready implication | Output does not imply Agent Chat is production-ready.                                  | P1               |
| C10     | Trace file exists               | Trace JSON exists after the run. Record path.                                          | P1               |
| C11     | Trace JSON valid                | Trace JSON parses as valid JSON.                                                       | P1               |
| C12     | Offline/no credentials          | Demo requires no network/API call and no credentials.                                  | P1               |
| C13     | Repeated run determinism        | Run repeatedly and compare meaningful output.                                          | P2               |
| C14     | Shogi variation                 | Intentionally different shogi excerpt if supported; otherwise mark not supported.      | P2               |
| C15     | Turn output clarity             | Each Grok/GLM turn is understandable.                                                  | P2               |

## D. README / GitHub surface tests

| Case ID | Case                      | Expected result                                       | Failure severity |
| ------- | ------------------------- | ----------------------------------------------------- | ---------------- |
| D1      | README GIFs render        | Both embedded GIFs render on GitHub.                  | P1               |
| D2      | README quickstart works   | README quickstart works exactly as shown.             | P0/P1            |
| D3      | npm link works            | npm package link opens the published package.         | P1               |
| D4      | v0.1.4 release link works | Release link opens v0.1.4.                            | P1               |
| D5      | Mode separation           | Best Route and Agent Chat separation is clear.        | P1               |
| D6      | README length             | README is short enough for first-time readers.        | P2               |
| D7      | No long launch copy       | README does not contain Product Hunt/X long copy.     | P2               |
| D8      | Boundary visibility       | License/runtime boundary is visible but not overlong. | P1/P2            |

## E. Release / npm / asset tests

| Case ID | Case                     | Command or action                                                                  | Expected result                                                                    | Failure severity |
| ------- | ------------------------ | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------- |
| E1      | npm latest               | `npm dist-tag ls create-quorum-router`                                             | `latest: 0.1.4`.                                                                   | P0               |
| E2      | npm version readback     | `npm view create-quorum-router@0.1.4 name version license bin dist.tarball --json` | Published package readback succeeds for `0.1.4`.                                   | P0/P1            |
| E3      | GitHub release assets    | `gh release view v0.1.4 --json assets,url,targetCommitish`                         | Four assets exist: Best Route GIF, Best Route MP4, Agent Chat GIF, Agent Chat MP4. | P1               |
| E4      | Release target unchanged | Compare target commit with recorded release readback.                              | Release target remains unchanged during dogfood.                                   | P0               |
| E5      | README asset paths       | Click README GIF/MP4 paths or inspect repository paths.                            | Asset paths resolve.                                                               | P1               |

## F. Claims / safety tests

Reject public posting if any visible surface claims any of the following without
an explicit negation or non-goal context:

- open source;
- production autonomous runtime;
- live Supabase Agent Bus runtime writes;
- service-role runtime;
- autonomous agent swarm;
- guaranteed best answer;
- Agent Chat production-ready;
- Best Route always uses Agent Chat.

Allowed claims:

- MIT;
- open source;
- Best Route/direct is production-ready best-answer routing;
- `agent_chat` is experimental explicit opt-in only;
- npm/NPX quickstart works.

| Case ID | Surface                         | Expected result                                                  | Failure severity |
| ------- | ------------------------------- | ---------------------------------------------------------------- | ---------------- |
| F1      | README                          | No disallowed claim.                                             | P0/P1            |
| F2      | docs                            | No disallowed claim.                                             | P0/P1            |
| F3      | docs/dogfood                    | Dogfood docs may list disallowed claims only as reject criteria. | P1               |
| F4      | docs/launch                     | Launch copy remains aligned with boundaries.                     | P1               |
| F5      | generated out/dogfood templates | Templates do not encourage unsafe or false claims.               | P1               |

## G. User experience tests

For each manual tester, record:

- OS;
- shell;
- Node version;
- npm version;
- Deno version;
- command run;
- expected result;
- actual result;
- time to success;
- confusion points;
- error messages;
- screenshot/GIF if useful;
- pass/fail;
- severity if failed.

| Case ID | Case                  | Expected result                                                                     | Failure severity |
| ------- | --------------------- | ----------------------------------------------------------------------------------- | ---------------- |
| G1      | First-time quickstart | Tester can complete README quickstart without extra help.                           | P1               |
| G2      | Error comprehension   | Tester can explain any failure and next step from the error message.                | P2               |
| G3      | Mode comprehension    | Tester can explain Best Route vs Agent Chat after reading README and running demos. | P1/P2            |
| G4      | Time to success       | Time from first command to successful smoke is acceptable for a public preview.     | P2               |
| G5      | Evidence quality      | Tester records enough logs/screenshots to reproduce failures.                       | P2               |
