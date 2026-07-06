# create-fusion-router

Create a local Fusion Router evaluation demo.

Fusion Router is **Source-Available Non-Commercial**. This is **not open
source**. Commercial, production, hosted-service/SaaS/API, redistribution,
sublicensing, integration, derivative commercialization, or competing
product/service use requires prior written permission.

## Usage

```bash
npx --yes create-fusion-router@latest my-fusion-router-demo
cd my-fusion-router-demo
deno task smoke
deno task intake
```

npm package target for this PR: `create-fusion-router@0.1.4`. Do not publish
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
RUN_EXTERNAL_MODEL_DOGFOOD=1 deno task best-route --prompt "Choose the safest launch copy."
RUN_EXTERNAL_MODEL_DOGFOOD=1 RUN_EXPERIMENTAL_AGENT_CHAT=1 deno task agent-chat --prompt "Review this launch plan."
```

`auth:login` does not ask for API keys as the primary path. If OAuth/browser
login is not wired in the generated scaffold, it fails closed and tells the user
to use an installed provider CLI login, then rerun `deno task intake`.

## Private/manual env fallback

Generic env fallback exists only as an explicit private/manual fallback with
`FUSION_ROUTER_AUTH_MODE=env`. It is never used silently, and it is not the
preferred public dogfood path.

Do not commit `.env`, `router.config.local.json`, `.fusion-router/`, or `out/`.
Do not paste tokens into chat/logs.

## Runtime boundaries

- Best Route/direct is production-ready best-answer routing.
- `agent_chat` is experimental explicit opt-in only.
- No production autonomous runtime.
- No service-role runtime.
- No live Supabase Agent Bus runtime writes.
- Public Product Hunt/X launch remains blocked until the user personally runs a
  local pre-release workspace and approves release continuation.

## CLI

```bash
create-fusion-router <dir>
create-fusion-router <dir> --template basic
create-fusion-router <dir> --force
create-fusion-router --help
create-fusion-router --version
```

The CLI refuses to overwrite a non-empty directory unless `--force` is passed.
