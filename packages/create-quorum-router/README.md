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
deno task calibration:demo
deno task calibration:hierarchy-demo
deno task intake
deno task supabase:status
```

Current package version: `create-quorum-router@0.1.19`. Releases are published
from an immutable Git tag through GitHub Actions OIDC Trusted Publishing.

## What the generated project supports

`deno task smoke` is deterministic fixture-only and does not call a provider
API.

`deno task calibration:demo` runs the bundled flat calibration-by-task API
against deterministic local observations. `deno task calibration:hierarchy-demo`
runs three deterministic scenarios that select at the prompt-pattern level, then
fall back to task subtype, then task type as narrower sample buckets become
insufficient. Generated projects also export
`aggregateHierarchicalTaskCalibration()` and
`resolveHierarchicalTaskCalibration()` with
`prompt_pattern → task_subtype → task_type` sample-count fallback. Reports are
advisory-only and are not connected to routing weights, provider eligibility, or
execution. Both demos are local-only; the hierarchy demo does not call provider
APIs. On a new Deno installation, the first run resolves the pinned Zod
dependency before execution.

Generated projects also export the opt-in
`resolveHierarchicalTaskCalibrationWithDriftGuard()` API. It can quarantine a
child whose Brier score is worse than its immediate parent by more than an
explicit caller threshold. This is outcome-metric drift handling, not semantic
label verification; it does not rename labels or affect routing authority.

`deno task intake` is the first real setup command. It detects local provider
wrappers, checks OAuth/session status, runs safe list-only model inventory where
possible, writes redacted local health artifacts under `out/`, and recommends
the next command.

```bash
deno task check
deno task smoke
deno task calibration:demo
deno task calibration:hierarchy-demo
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
RUN_EXTERNAL_MODEL_DOGFOOD=1 RUN_AGENT_CHAT=1 deno task agent-chat --prompt "Review this launch plan."
```

`route:once` and `best-route` also accept
`--calibration-evidence ./calibration-evidence.json`. The generated CLI
caller-attested outcomes before invoking providers and stores the advisory
metrics with hashed task/source identifiers in the route trace without changing
routing authority.

`auth:login` does not ask for API keys as the primary path. If OAuth/browser
login is not wired in the generated scaffold, it fails closed and tells the user
to use an installed provider CLI login, then rerun `deno task intake`.

## Private/manual env fallback

Generic env fallback exists only as an explicit private/manual fallback with
`QUORUM_ROUTER_AUTH_MODE=env`. It is never used silently, and it is not the
preferred public dogfood path.

Do not commit `.env`, `router.config.local.json`, `.quorum-router/`, or `out/`.
Do not paste tokens into chat/logs.

## Optional user-owned Supabase audit

The generated project works without Supabase. Audit defaults to `disabled`.
Users who opt in apply the generated migration to a Supabase project they own,
choose `optional` or `required` in the non-secret feature config, inject a
project URL, publishable/anon key, and Supabase Auth session JWT at runtime, and
run `deno task supabase:status` before routing.

The runtime rejects service-role/admin credentials. Audit records exclude
prompts, model responses, credentials, client-supplied actor/org identity, and
client timestamps. Agent Bus, Realtime, state sync, and analytics dashboards are
not part of this integration.

## Runtime boundaries

- Best Route/direct is production-ready best-answer routing.
- Conversation-only `agent_chat` is explicit opt-in.
- SafeLoop-backed Agent Chat can perform the verified local repository execution
  slice only when separately configured with signed policy and distinct
  approval.
- The generated scaffold does not enable mutation by default.
- No service-role/admin runtime credentials.
- No live Supabase Agent Bus runtime writes.
- Public launch requires the repository verification, package tarball, registry
  readback, and clean-room NPX scaffold checks to pass.

## CLI

```bash
create-quorum-router <dir>
create-quorum-router <dir> --template basic
create-quorum-router <dir> --force
create-quorum-router --help
create-quorum-router --version
```

The CLI refuses to overwrite a non-empty directory unless `--force` is passed.
