# Fusion Router evaluation demo

This demo is for local, non-commercial evaluation of Fusion Router v0.1.2.

Fusion Router is **Source-Available Non-Commercial**. This is **not open
source**. Production, commercial, hosted-service/SaaS/API, redistribution,
sublicensing, integration, derivative commercialization, or competing
product/service use requires prior written permission.

## Security and runtime boundaries

- Non-commercial evaluation only.
- No production autonomous runtime.
- No service-role runtime.
- No live Supabase runtime writes.
- No Supabase Realtime subscriber.
- `direct` is the production-ready best-answer routing path.
- `agent_chat` is experimental explicit opt-in.
- The demo does not ask for credentials or write secrets.
- The demo does not enable process adapters.

## Quick start

```bash
deno task check
deno task smoke
```

`deno task smoke` imports `router.ts` from the published `v0.1.2` Git tag:

```text
https://raw.githubusercontent.com/sakamoto-sann/fusion-router/v0.1.2/router.ts
```

That means `deno task smoke` requires network access to
`raw.githubusercontent.com` and requires the `v0.1.2` tag to exist. The tag is
used intentionally so the public quickstart follows the published release URL;
for reproducibility-sensitive evaluation, verify the `v0.1.2` Git tag target in
GitHub release metadata before running. If you are evaluating before the tag is
published, run `deno task check` first and retry `deno task smoke` after the
release is live.

## What runs

`main.ts` creates deterministic fixture model and synthesis adapters, runs
`FusionRouter` in default direct mode, and prints a small JSON success payload.
It does not require API keys.
