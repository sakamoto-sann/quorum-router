# Local multi-model dogfood workspace

This is the primary local dogfood workspace for Fusion Router. NPX is not the
goal here: the goal is to discover the models that are actually usable from this
machine's existing OAuth, wrapper, CLI session, or explicit env fallback setup,
then route real tasks through them.

Public Product Hunt/X launch remains **NO-GO** until the user personally
confirms a real local multi-model dogfood pass and reviews the sanitized trace.

## Commands

`inventory` and `auth:status` may run safe list-only probes such as
`grok models`; they do not invoke model generation and they redact diagnostics.

```bash
deno task inventory
deno task auth:status
deno task health
RUN_EXTERNAL_MODEL_DOGFOOD=1 deno task route:once --prompt "Review this README for risky claims."
RUN_EXTERNAL_MODEL_DOGFOOD=1 deno task best-route --prompt "Choose the safest launch copy."
RUN_EXTERNAL_MODEL_DOGFOOD=1 RUN_EXPERIMENTAL_AGENT_CHAT=1 deno task agent-chat --prompt "Review this launch plan."
```

## Auth priority

Default `FUSION_ROUTER_AUTH_MODE=auto` prefers local wrappers/sessions and does
not silently use API-key env fallback. Supported values:

- `auto` — local wrapper/session first; env fallback is reported but not used;
- `wrapper` — only local wrapper / CLI session providers;
- `oauth` — OAuth-backed wrappers only;
- `env` — explicit generic OpenAI-compatible env fallback.

Env fallback is allowed for private manual dogfood only and is **not** the
primary public launch proof:

```bash
export FUSION_ROUTER_AUTH_MODE=env
export FUSION_ROUTER_PROVIDER_BASE_URL="https://..."
export FUSION_ROUTER_PROVIDER_MODEL="..."
export FUSION_ROUTER_PROVIDER_LABEL="my-provider" # optional
# Also set FUSION_ROUTER_PROVIDER_API_KEY in your private shell.
# Never commit or paste its value.
```

## Trace output

Traces are written under:

```text
../../out/dogfood/local-model-dogfood/
```

Trace files contain prompt hashes and summaries, response summaries, routing
scores, schema/redaction flags, and runtime boundaries. They must not contain
OAuth tokens, refresh tokens, API keys, Authorization headers, cookies, raw
session files, `.env` contents, or credential-bearing config.

## Boundaries

- `deno task smoke` elsewhere remains fixture-only; it is not real provider
  dogfood.
- Best Route/direct remains the production-ready best-answer routing path.
- `agent_chat` remains experimental explicit opt-in only.
- No production autonomous runtime is claimed.
- No live Supabase Agent Bus runtime writes are made.
- No service-role runtime exists.
