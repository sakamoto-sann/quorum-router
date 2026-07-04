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
production-ready `direct` / Best Route best-answer routing and explicit opt-in
experimental `agent_chat` routing.

## Short description

Fusion Router v0.1 Public RC gives builders a small, readable Deno framework for
routing prompts through model adapters, validating outputs, and synthesizing a
best answer through the production-ready Best Route / `direct` path.
Experimental `agent_chat` exists only behind explicit opt-in gates.

## Launch media captions

- GIF 1 shows Best Route mode choosing a shogi next move in a Grok vs GLM
  deterministic fixture.
- GIF 2 shows experimental Agent Chat mode with a short Grok vs GLM shogi
  excerpt, then fades out before the full match.

Use the two GIFs together and keep the boundary explicit: Best Route does not
imply `agent_chat`, and `agent_chat` is not the production-ready default path.

## Long description

Fusion Router is a source-available routing/runtime framework for teams that
want routing safety before agent autonomy.

The v0.1 Public RC focuses on:

- Best Route / `direct` as the production-ready best-answer routing path.
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

## Demo commands

Best Route shogi excerpt:

```bash
cd examples/best-route-game
deno task demo
```

Agent Chat shogi excerpt:

```bash
cd examples/agent-chat-game
deno task demo
```

Both demos are deterministic fixtures. `Grok` and `GLM` are fixture labels; no
external Grok/GLM model/API call is made and no credentials are required.

## Maker comment draft

Thanks for checking out Fusion Router v0.1 Public RC.

The main idea is simple: treat routing as the safety boundary before agents. The
production-ready path is Best Route / `direct`: compare answer routes, validate
outputs, and produce a best answer through a fail-closed contract. `agent_chat`
is present for explicit experimental opt-in only, not as a production autonomous
runtime.

Launch media is split into two GIFs to avoid mode confusion:

1. GIF 1 shows Best Route mode choosing a shogi next move in a Grok vs GLM
   deterministic fixture.
2. GIF 2 shows experimental Agent Chat mode with a short Grok vs GLM shogi
   excerpt, then fades out before the full match.

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

## Runtime boundary warning

- Best Route / `direct` is the production-ready best-answer routing path.
- `agent_chat` is experimental explicit opt-in only.
- Best Route does not imply `agent_chat`.
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
- Developers who want deterministic demos to inspect and run locally.

## Who it is not for

- Teams that require an OSI-approved permissive or copyleft license.
- Teams needing commercial, production, hosted-service/SaaS/API, redistribution,
  sublicensing, integration, derivative commercialization, or competing
  product/service rights without prior written permission.
- Users looking for a production autonomous agent runtime.
- Users expecting Supabase Agent Bus writes or privileged runtime credentials in
  the live runtime path.
- Users who need production multi-agent autonomy out of the box.
