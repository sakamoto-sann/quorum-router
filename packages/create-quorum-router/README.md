# create-quorum-router

Create a local QuorumRouter project scaffold.

QuorumRouter is **MIT-licensed open source**. Commercial and production use are
permitted under the MIT License.

## Usage

```bash
npx --yes create-quorum-router@latest my-quorum-router-demo
cd my-quorum-router-demo
deno --version
deno task smoke
deno task intake
```

npm package target for this PR: `create-quorum-router@0.1.4`. Do not publish
this version until the PR is merged, v0.1.4 release/tag handling is approved,
and the user personally approves local pre-release workspace dogfood results.

## What the generated project supports

`deno task smoke` is deterministic fixture-only and does not call a provider
API.

`deno task intake` is the first real setup command. It detects local provider
wrappers, checks OAuth/session status, runs safe list-only model inventory where
possible, writes redacted local health artifacts under `out/`, and recommends
the next command.

```bash
deno task check
deno task smoke
deno task intake
deno task auth:status
deno task auth:login
deno task auth:logout
deno task models:list
deno task health
```

Real provider use is OAuth/session/wrapper-first:

```bash
RUN_EXTERNAL_MODEL_DOGFOOD=1 deno task route:once --prompt "Review this README for risky claims."
RUN_EXTERNAL_MODEL_DOGFOOD=1 deno task route:once --prompt "https://github.com/sakamoto-sann/quorum-router review this repo's launch readiness."
# GitHub URL prompts fetch bounded repository context before invoking the selected provider.
# Only use this with repositories you are allowed to send to that provider.
RUN_EXTERNAL_MODEL_DOGFOOD=1 deno task best-route --prompt "Choose the safest launch copy."
RUN_EXTERNAL_MODEL_DOGFOOD=1 RUN_EXPERIMENTAL_AGENT_CHAT=1 deno task agent-chat --prompt "Review this launch plan."
```

`auth:login` does not ask for API keys as the primary path. If OAuth/browser
login is not wired in the generated scaffold, it fails closed and tells the user
to use an installed provider CLI login, then rerun `deno task intake`.

## Private/manual env fallback

Generic env fallback exists only as an explicit private/manual fallback with
`QUORUM_ROUTER_AUTH_MODE=env`. It is never used silently, and it is not the
preferred public dogfood path.

Do not commit `.env`, `router.config.local.json`, `.quorum-router/`, or `out/`.
Do not paste tokens into chat/logs.

## Runtime boundaries

- Best Route/direct is production-ready best-answer routing.
- Conversation-only `agent_chat` is explicit opt-in.
- SafeLoop-backed Agent Chat can perform the verified local repository execution
  slice only when separately configured with signed policy and distinct
  approval.
- The generated scaffold does not enable mutation by default.
- No service-role runtime.
- No live Supabase Agent Bus runtime writes.
- Public Product Hunt/X launch remains blocked until the user personally runs a
  local pre-release workspace and approves release continuation.

## CLI

```bash
create-quorum-router <dir>
create-quorum-router <dir> --template basic
create-quorum-router <dir> --force
create-quorum-router --help
create-quorum-router --version
```

The CLI refuses to overwrite a non-empty directory unless `--force` is passed.
