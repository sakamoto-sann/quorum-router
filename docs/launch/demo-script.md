# Terminal demo script — Fusion Router v0.1 Public RC

> Script for a recorded or live terminal demo. Do not claim production
> autonomous runtime, live Supabase Agent Bus runtime writes, service-role
> runtime, or open source licensing.

## Setup

Use a clean temporary directory so the demo shows exactly what the public NPX
path creates.

## Exact commands

```bash
npx --yes create-fusion-router@latest my-fusion-router-demo
cd my-fusion-router-demo
find . -maxdepth 2 -type f | sort
cat deno.json
cat main.ts
deno task check
deno task smoke
```

## Expected output summary

### 1. Scaffold

Expected summary:

```text
Created Fusion Router evaluation demo in .../my-fusion-router-demo

Next steps:
  cd my-fusion-router-demo
  deno task check
  deno task smoke
```

The command should create a local demo directory. It should not ask for
credentials and should not configure runtime services.

### 2. Files

Expected files:

```text
./README.md
./deno.json
./main.ts
```

### 3. `cat deno.json`

Narrate that the generated demo is intentionally small. `deno.json` defines the
`check` and `smoke` tasks and includes an import map for `zod` so the
release-tagged runtime import can resolve.

### 4. `cat main.ts`

Narrate that `main.ts` uses deterministic fixture adapters and the default
`direct` route. It demonstrates best-answer routing without configuring a
production autonomous runtime.

### 5. `deno task check`

Expected summary:

```text
Task check deno check main.ts
Check main.ts
```

### 6. `deno task smoke`

Expected summary:

```text
Task smoke deno run --allow-net=raw.githubusercontent.com main.ts
Starting parallel model execution...
Received 1 validated responses. Synthesizing with Fixture/synthesis-evaluation...
{
  "ok": true,
  ...
}
```

The required success marker is:

```json
{
  "ok": true
}
```

## What to narrate

- “This is Fusion Router v0.1 Public RC.”
- “The public quickstart uses `create-fusion-router@latest`, currently resolving
  to `0.1.3`.”
- “`0.1.3` is an engineering NPX scaffold / generated-demo compatibility patch,
  not a separate product milestone.”
- “The generated demo is intentionally small: README, Deno task config, and one
  TypeScript file.”
- “The production-ready path is `direct`: best-answer routing with validation
  and fail-closed behavior.”
- “`agent_chat` exists as experimental explicit opt-in only.”
- “Fusion Router is Source-Available Non-Commercial, not open source.”

## What not to claim

- Do not claim Fusion Router is open source.
- Do not claim this demo is a production autonomous runtime.
- Do not claim `agent_chat` is production-ready.
- Do not claim live Supabase Agent Bus runtime writes exist.
- Do not claim service-role runtime exists.
- Do not claim this is a full multi-agent production system.
- Do not imply commercial, production, hosted-service/SaaS/API, redistribution,
  integration, or derivative commercialization use is allowed without prior
  written permission.
