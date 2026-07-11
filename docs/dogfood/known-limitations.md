# Known limitations for v0.1 public preview dogfood

These limitations are acceptable only if they are visible to testers and all
must-pass launch checks pass.

## Runtime and install limitations

| Limitation                                                                     | Expected user impact                                                                              | Launch handling                                                              |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Deno is required.                                                              | Users without Deno cannot run generated `deno task` checks or demos until they install Deno.      | Document in quickstart/troubleshooting.                                      |
| Network is required for remote module resolution.                              | First run may fail when Deno, npm, or GitHub raw content is unreachable.                          | Error should be understandable; record network failures during dogfood.      |
| npm/NPX relies on public registry availability.                                | `npx create-quorum-router@latest` can fail when npm is unavailable or blocked.                    | Treat as external dependency if registry readback is healthy.                |
| `agent_chat` is a deterministic demo fixture / experimental.                   | It demonstrates mode separation and role output; it is not a production-ready Agent Chat runtime. | Keep explicit opt-in experimental wording.                                   |
| MIT permits commercial use.                                                    | Commercial use is permitted under the MIT License.                                                | Keep license boundary visible and concise.                                   |
| v0.1.3 tag predates PR #40 demo files, while README/main has latest demo docs. | Release tag assets and package exist, but main README/docs may include later launch docs.         | Keep release target readback explicit; do not mutate existing tags/releases. |

## Claim boundaries

- Best Route / direct mode is the production-ready best-answer routing path.
- Agent Chat is experimental and explicit opt-in only.
- There is no production autonomous runtime in this RC.
- There are no live Supabase Agent Bus runtime writes in this RC.
- There is no service-role runtime in this RC.
- The license is MIT, open source.

## When a limitation becomes a blocker

A known limitation becomes a launch blocker if:

- the README or demo hides the limitation;
- the error message is confusing enough that a first-time tester cannot recover;
- the limitation contradicts a visible launch claim;
- the limitation causes a P0/P1 in the manual matrix;
- the limitation requires credentials or secrets for the public quickstart.
