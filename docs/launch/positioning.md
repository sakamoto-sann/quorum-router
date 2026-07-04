# Positioning — Fusion Router v0.1 Public RC

## Crisp positioning

Fusion Router is a source-available routing/runtime framework for
production-ready `direct` best-answer routing and explicit opt-in experimental
agent routing.

The v0.1 Public RC message is:

> Routing first, agents second.

Fusion Router makes the stable path a fail-closed best-answer router.
Agent-style routing exists only as an explicitly opted-in experimental surface.

## Anti-positioning

Fusion Router v0.1 Public RC is not:

- not an open source project;
- not a production autonomous agent runtime;
- not a full multi-agent production system;
- not a live Supabase Agent Bus runtime writer;
- not a service-role runtime;
- a hosted SaaS/API product;
- a permissively licensed commercial integration surface;
- a generic “agent framework” that treats autonomy as the default.

## Comparison framing against generic agent frameworks

Generic agent frameworks often start from autonomous loops, tools, memory, and
delegation.

Fusion Router starts one layer earlier:

1. Which routing path is allowed?
2. Which adapter outputs are valid?
3. What happens when outputs are malformed or unsafe?
4. Can the system synthesize a best answer without escalating to autonomous
   behavior?
5. If agent routing is requested, did the caller explicitly opt in?

That makes `direct` the production-ready path and keeps `agent_chat`
experimental.

## Comparison framing against prompt routers

Prompt routers often focus on choosing a model or prompt path.

Fusion Router frames routing as a runtime safety boundary:

- adapters return structured outputs;
- validation is part of the route;
- synthesis is explicit;
- failures are fail-closed;
- experimental agent routing is gated, not implicit.

The goal is not only “pick a model.” The goal is to make the route inspectable
and bounded.

## Launch narrative

Fusion Router v0.1 Public RC is ready for external evaluation through the public
NPX scaffold:

```bash
npx --yes create-fusion-router@latest my-fusion-router-demo
cd my-fusion-router-demo
deno task smoke
```

The npm package is `create-fusion-router@0.1.3` (`latest -> 0.1.3`). Version
`0.1.3` is an engineering NPX scaffold / generated-demo compatibility patch in
the v0.1 Public RC line, not a separate product milestone.

The release is deliberately narrow: prove the public path, explain the safety
boundaries, and give builders a readable generated demo.

## “Routing first, agents second” explanation

A routing framework should not require autonomous agents to be useful.

In Fusion Router:

- `direct` handles production-ready best-answer routing.
- `agent_chat` is available only as experimental explicit opt-in.
- no hidden fallback turns an invalid route into an unsafe route.
- no production autonomous runtime is claimed.

The agent story is intentionally behind the routing story. That keeps the Public
RC useful for builders who want reliable adapter routing today while preserving
a clear path for future explicit agent experiments.

## Safety boundary

The Public RC safety boundary is:

- `direct` remains the production-ready best-answer routing path.
- `agent_chat` remains experimental explicit opt-in only.
- No production autonomous runtime.
- No live Supabase Agent Bus runtime writes.
- No service-role runtime.
- No full multi-agent production-system claim.
- No hidden runtime expansion from the NPX scaffold.

## License boundary

Fusion Router is Source-Available Non-Commercial.

This is not an open source license.

Commercial, production, hosted-service/SaaS/API, redistribution, sublicensing,
integration, derivative commercialization, or competing product/service use
requires prior written permission.

Personal evaluation, academic or non-commercial research, and non-production
testing are the intended evaluation allowances under the license terms.
