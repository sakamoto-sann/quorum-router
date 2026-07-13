# QuorumRouter generated workspace

This generated workspace contains the MIT-licensed QuorumRouter current release.
npm latest targets v0.1.14.

QuorumRouter is **MIT**. It is **open source**. Commercial and production use
are permitted under the MIT License.

## Security and runtime boundaries

- MIT-licensed open source; commercial and production use are permitted.
- `deno task smoke` is fixture-only and credential-free.
- `deno task intake` is the first real setup command.
- Real provider use is OAuth/session/wrapper-first.
- API key env fallback is private/manual only and never used silently.
- Never commit `.env`, `router.config.local.json`, `provider_config.json`,
  `.quorum-router/`, or `out/` traces.
- Never paste tokens into chat/logs.
- Conversation-only `agent_chat` is explicit opt-in.
- SafeLoop-backed production repository execution is not enabled by this
  generated scaffold; it requires external signed policy and distinct approval.
- No service-role runtime; service-role/admin credentials are rejected even when
  audit is disabled.
- BYO Supabase audit is disabled by default and writes only when explicitly set
  to `optional` or `required`.
- No live Supabase Agent Bus runtime writes.
- Best Route/direct is the production-ready best-answer routing path.
- `agent-chat` is read-only explicit opt-in only.

## First launch

Prerequisite: install Deno before running scaffold tasks. Verify with:

```bash
deno --version
```

```bash
deno task smoke
deno task calibration:demo
deno task calibration:hierarchy-demo
deno task intake
deno task auth:status
deno task models:list
deno task health
deno task supabase:status
```

`smoke` proves the local scaffold runs with deterministic fixtures only. It does
**not** call a real provider API.

`calibration:demo` exercises the bundled flat calibration-by-task API with local
fixture observations. `calibration:hierarchy-demo` runs three deterministic
queries that select a sufficient prompt-pattern group, fall back to task
subtype, and fall back again to task type. Calibration reports are
advisory-only: the scaffold does not use them to change routing weights, ranks,
provider eligibility, quorum, or execution. Both demos are local-only; the
hierarchy demo does not call provider APIs. On a new Deno installation, the
first run resolves the pinned Zod dependency before execution.

The hierarchical demo uses `aggregateHierarchicalTaskCalibration()` and
`resolveHierarchicalTaskCalibration()` from `src/calibration.ts`. Its
observations use caller-defined categories such as `task_type: "code-review"`,
`task_subtype: "typescript"`, and `prompt_pattern: "schema-boundary-review"`.
Resolution checks `prompt_pattern → task_subtype → task_type`, using the first
group that reaches the configured sample threshold. Groups never cross exact
provider/model source boundaries, labels must not contain raw prompts, and the
result remains advisory-only.

`intake` detects local provider wrappers, checks OAuth/session status, runs safe
model inventory/list-only probes where possible, writes local health traces
under `out/`, and recommends the next command.

In short: intake is the first real setup command before `route:once`,
`best-route`, or read-only `agent-chat`.

## Optional BYO Supabase audit

Supabase is not required. With no Supabase config or env, every existing task
keeps its prior behavior and `deno task supabase:status` exits successfully with
`state: disabled` without making a network request.

To persist route outcomes in a Supabase project you own:

1. Create or choose your Supabase project.
2. Apply **both** files under `supabase/migrations/` in filename order using an
   admin context outside the router runtime. The later limits migration is
   mandatory.
3. Ensure the active Supabase Auth user session JWT has an authenticated `sub`.
4. Copy `router.config.example.json` to `router.config.json` and set only
   `features.supabase.audit.mode` to `optional` or `required`.
5. Inject `QUORUM_ROUTER_SUPABASE_URL`, `QUORUM_ROUTER_SUPABASE_ANON_KEY`, and
   `QUORUM_ROUTER_SUPABASE_SESSION_JWT` at runtime.
6. Run `deno task supabase:status`, then run `route:once` or `best-route`.

`optional` preserves a successful route and prints a warning when audit delivery
fails. `required` withholds the route result and exits nonzero when audit
delivery fails. The RPC receives only the route decision and bounded metadata.
It never receives prompts, model responses, credentials, `org_id`, `actor_id`,
or `created_at`; the database derives both the actor and this single-user BYO
audit namespace from `auth.uid()` and owns the timestamp. There is no central or
shared database and no client tenant claim.

Runtime service-role/admin credentials are forbidden. Agent Bus, Realtime
wakeup, state sync, and an analytics dashboard are future features and are not
enabled by this audit integration.

## Real provider dogfood commands

Run only after a live probe verifies provider authentication:

```bash
RUN_EXTERNAL_MODEL_DOGFOOD=1 deno task route:once --prompt "Review this README for risky claims."
RUN_EXTERNAL_MODEL_DOGFOOD=1 deno task best-route --prompt "Choose the safest launch copy."
RUN_EXTERNAL_MODEL_DOGFOOD=1 RUN_AGENT_CHAT=1 deno task agent-chat --prompt "Review this launch plan."
```

Behavior:

- `route:once` requires `RUN_EXTERNAL_MODEL_DOGFOOD=1`.
- `best-route` requires `RUN_EXTERNAL_MODEL_DOGFOOD=1`.
- `route:once` and `best-route` accept
  `--calibration-evidence ./calibration-evidence.json`; evidence is validated
  before provider invocation. The trace stores advisory metrics with hashed task
  and source identifiers, not raw labels.
- `agent-chat` requires both `RUN_EXTERNAL_MODEL_DOGFOOD=1` and
  `RUN_AGENT_CHAT=1`.
- Live Agent Chat requires at least two distinct working provider/model
  identities. It passes the bounded transcript to alternating models, prints
  each response and `replying to` lineage as it arrives, and stores turns in
  `out/agent-chat-trace.json`.
- Set `QUORUM_ROUTER_AGENT_CHAT_MAX_TURNS` from 2–12 (default 6) to bound calls.
- Default auth mode is OAuth/session/wrapper-first.
- In auto mode, `route:once` prefers list-verified wrapper models and safely
  tries the next wrapper when an invocation fails; the trace records the failed
  attempt and `fallback_used`.
- Explicit provider/model selection never falls back to a different wrapper.
- Env fallback is used only with `QUORUM_ROUTER_AUTH_MODE=env` and local private
  credential environment.
- Traces are redacted and written under `out/`.
- When the prompt contains a GitHub repository URL like
  `https://github.com/owner/repo`, `route:once`, `best-route`, and read-only
  `agent-chat` fetch a bounded, prioritized set of repository text files first,
  quote them as untrusted JSON data, and record context coverage in the trace.
  Only use this with repositories you are allowed to send to the selected
  provider.

### Cost-aware Best Route

Cost-aware routing is disabled unless both budget variables are set. Estimates
are user-supplied per invocation, not live provider billing data.

```bash
QUORUM_ROUTER_MAX_BUDGET_USD=0.05 \
QUORUM_ROUTER_ESTIMATED_COSTS_JSON='{"openai/gpt-5":0.03,"xai/grok":0.02}' \
RUN_EXTERNAL_MODEL_DOGFOOD=1 \
  deno task best-route --prompt "Choose the safest launch copy."
```

Best Route preserves candidate quality/readiness order, admits candidates while
their configured estimates fit the budget, and records selected and excluded
model IDs plus reasons in `out/best-route-trace.json`. Models without an
estimate are excluded when cost-aware routing is enabled. If no candidate fits,
the command fails before invoking a provider. This is pre-invocation budget
control; it does not claim exact or live API spend.

### Forced wrapper provider/model selection

Use these only when you want a specific local wrapper/model. The scaffold fails
closed if the requested provider or model is unavailable; it never silently
falls back to OpenAI/Codex or private env fallback unless
`QUORUM_ROUTER_AUTH_MODE=env` is explicit.

```bash
QUORUM_ROUTER_AUTH_MODE=wrapper \
QUORUM_ROUTER_PROVIDER_LABEL=grok-cli \
QUORUM_ROUTER_PROVIDER_MODEL=grok-build \
RUN_EXTERNAL_MODEL_DOGFOOD=1 \
  deno task route:once --prompt "Review this README for risky claims."

QUORUM_ROUTER_AUTH_MODE=wrapper \
QUORUM_ROUTER_PROVIDER_LABEL=grok-cli \
QUORUM_ROUTER_PROVIDER_MODEL=grok-composer-2.5-fast \
RUN_EXTERNAL_MODEL_DOGFOOD=1 \
  deno task route:once --prompt "Review this README for usability."
```

Supported provider aliases include `grok-cli`, `grok`, `xai`, `xAI`, `OpenAI`,
`codex-cli`, `claude-code`, `gemini-cli`, and `devin-cli`. Wrapper invocations
use argv arrays, closed stdin, timeout guards, and sanitized stdout/stderr; CLI
banners or auth/runtime errors are not accepted as valid model answers.

## Auth and inventory

```bash
deno task auth:status
deno task auth:login
deno task auth:logout
deno task models:list
```

`auth:login` does not ask for API keys as the primary path. If OAuth/browser
login is not wired in this scaffold, it fails closed and tells you to use an
installed provider CLI login, then rerun `deno task intake`.

Browser/device login handling is safe-by-default: the scaffold does not open a
browser automatically. Provider CLIs own their own login flows.

## Private/manual env fallback

Generic OpenAI-compatible env fallback exists only as an explicit private
fallback:

```bash
QUORUM_ROUTER_AUTH_MODE=env \
RUN_EXTERNAL_MODEL_DOGFOOD=1 \
  deno task route:once --prompt "Review this README change."
```

Credential values must come from your local environment or secret manager. Do
not paste them into chat/logs and do not commit `.env`.

## Generated files

- `main.ts` — deterministic fixture smoke only.
- `deno.json` — generated task surface.
- `README.md` — practical first-launch guide.
- `.gitignore` — excludes `.env`, `out/`, `router.config.local.json`,
  `provider_config.json`, and `.quorum-router/`.
- `router.config.example.json` — non-secret example boundaries.
- `supabase/migrations/20260701130000_workflow_access_audit.sql` — optional BYO
  Supabase audit migration
- `supabase/migrations/20260712211500_workflow_access_audit_limits.sql` —
  required RPC narrowing and payload-limit migration
- `src/cli.ts` — command dispatcher.
- `src/supabase.ts` — offline status and selective audit RPC hook.
- `src/intake.ts` — first-run onboarding.
- `src/auth.ts`, `src/auth_oauth.ts`, `src/auth_session.ts`,
  `src/auth_env_fallback.ts` — auth/session/fallback boundaries.
- `src/provider_registry.ts`, `src/model_inventory.ts`, `src/wrapper_client.ts`,
  `src/provider_client.ts` — provider discovery and safe invocation.
- `src/best_route.ts`, `src/agent_chat.ts` — gated dogfood commands.
- `src/cost_aware.ts` — estimated-cost budget selection for Best Route.
- `src/calibration.ts`, `src/calibration_demo.ts` — strict flat and hierarchical
  advisory aggregation, parent fallback resolution, and an offline runnable
  example.
- `src/trace.ts`, `src/redact.ts`, `src/schema.ts`, `src/fixture_smoke.ts` —
  trace/redaction/schema/fixture support.
- `out/.gitkeep` — local output directory placeholder.

This generated scaffold operates locally. It does not publish npm packages,
create GitHub releases, or mutate tags or dist-tags.
