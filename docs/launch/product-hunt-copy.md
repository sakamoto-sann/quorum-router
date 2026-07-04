# Product Hunt copy — Fusion Router v0.1 Public RC

> Draft asset only. Do not create or publish a Product Hunt listing from this
> file without explicit approval.

## Product name

Fusion Router

## Tagline options

1. Source-available best-answer routing for LLM adapters.
2. Fail-closed routing before autonomous agents.
3. A Deno routing/runtime framework for direct best-answer paths and explicit
   experimental agent routing.
4. Build safer model routing with clear runtime boundaries.
5. Direct routing first. Agent routing only when explicitly opted in.

## One-liner

Fusion Router is a source-available routing/runtime framework for
production-ready `direct` best-answer routing and explicit opt-in experimental
`agent_chat` routing.

## Short description

Fusion Router v0.1 Public RC gives builders a small, readable Deno framework for
routing prompts through model adapters, validating outputs, and synthesizing a
best answer through the production-ready `direct` path. Experimental
`agent_chat` exists only behind explicit opt-in gates.

## Long description

Fusion Router is a source-available routing/runtime framework for teams that
want routing safety before agent autonomy.

The v0.1 Public RC focuses on:

- `direct` as the production-ready best-answer routing path.
- Zod-validated adapter and synthesis outputs.
- fail-closed boundaries for invalid routing modes, malformed responses, and
  unsafe runtime expansion.
- explicit opt-in experimental `agent_chat` for multi-role routing experiments.
- clear non-goals: no production autonomous runtime, no live Supabase Agent Bus
  runtime writes, and no service-role runtime.

The live npm scaffold is `create-fusion-router@0.1.3` (`latest -> 0.1.3`).
Version `0.1.3` is an engineering NPX scaffold / generated-demo compatibility
patch in the v0.1 Public RC line, not a separate product milestone.

Fusion Router is Source-Available Non-Commercial. This is not an open source
license. Commercial, production, hosted-service/SaaS/API, redistribution,
sublicensing, integration, derivative commercialization, or competing
product/service use requires prior written permission.

## Clear install command

```bash
npx --yes create-fusion-router@latest my-fusion-router-demo
cd my-fusion-router-demo
deno task smoke
```

Fixed package version:

```bash
npx --yes create-fusion-router@0.1.3 my-fusion-router-demo
cd my-fusion-router-demo
deno task smoke
```

## Maker comment draft

Thanks for checking out Fusion Router v0.1 Public RC.

The main idea is simple: treat routing as the safety boundary before agents. The
production-ready path is `direct`: fan out to adapters, validate outputs, and
synthesize a best answer through a fail-closed contract. `agent_chat` is present
for explicit experimental opt-in only, not as a production autonomous runtime.

Quickstart:

```bash
npx --yes create-fusion-router@latest my-fusion-router-demo
cd my-fusion-router-demo
deno task smoke
```

The npm package is `create-fusion-router@0.1.3`; `0.1.3` is an engineering NPX
scaffold / generated-demo compatibility patch for the v0.1 Public RC line, not a
separate milestone.

License note: Fusion Router is Source-Available Non-Commercial, not open source.
Commercial or production use requires prior written permission.

## First comment / launch day comment

Launch day checklist for anyone trying it:

1. Run the NPX quickstart.
2. Confirm the generated demo prints `"ok": true`.
3. Read the generated `main.ts` and `deno.json`; the demo is intentionally
   small.
4. Use `direct` for the production-ready best-answer path.
5. Treat `agent_chat` as experimental explicit opt-in only.
6. Do not assume production autonomous runtime, live Supabase runtime writes, or
   service-role runtime exist.
7. Check the license before commercial, production, hosted-service, SaaS/API,
   redistribution, sublicensing, integration, or derivative commercialization
   use.

## Maker talking points

- Routing first, agents second: the stable surface is a fail-closed best-answer
  route.
- `direct` is the production-ready path; it does not require autonomous agent
  orchestration.
- `agent_chat` exists for explicit experimental opt-in only.
- The generated demo is intentionally readable: `README.md`, `deno.json`, and
  `main.ts`.
- The scaffold is live on npm as `create-fusion-router@0.1.3` with
  `latest -> 0.1.3`.
- `0.1.3` is an engineering NPX scaffold / generated-demo compatibility patch,
  not a separate product milestone.
- Source-Available Non-Commercial means source review and non-commercial
  evaluation are allowed, but it is not open source.
- The project does not claim a production autonomous runtime, live Supabase
  Agent Bus runtime writes, or service-role runtime.

## License warning

Fusion Router is Source-Available Non-Commercial. This is not an open source
license.

Commercial, production, hosted-service/SaaS/API, redistribution, sublicensing,
integration, derivative commercialization, or competing product/service use
requires prior written permission.

## Runtime boundary warning

- `direct` is the production-ready best-answer routing path.
- `agent_chat` is experimental explicit opt-in only.
- No production autonomous runtime.
- No live Supabase Agent Bus runtime writes.
- No service-role runtime.
- No full multi-agent production system claim.

## Who it is for

- Builders evaluating fail-closed model routing.
- Teams that want a readable Deno routing framework before adopting agent
  autonomy.
- Researchers and non-commercial evaluators comparing direct best-answer routing
  patterns.
- Developers who want a small generated demo to inspect and run locally.

## Who it is not for

- Teams seeking an open source license.
- Teams needing commercial, production, hosted-service/SaaS/API, redistribution,
  sublicensing, integration, derivative commercialization, or competing
  product/service rights without prior written permission.
- Users looking for a production autonomous agent runtime.
- Users expecting live Supabase Agent Bus runtime writes or service-role
  runtime.
- Users who need production multi-agent autonomy out of the box.
