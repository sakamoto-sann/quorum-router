# Positioning — QuorumRouter current release

## Crisp positioning

QuorumRouter is a source-available routing/runtime framework for
production-ready `direct` best-answer routing and read-only explicit agent
routing.

The current release message is:

> Routing first, agents second.

QuorumRouter makes the stable path a fail-closed best-answer router. Agent-style
conversation is read-only; action execution is experimental and delegated to
SafeLoop as the sole authority.

## Anti-positioning

QuorumRouter current release is not:

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

QuorumRouter starts one layer earlier:

1. Which routing path is allowed?
2. Which adapter outputs are valid?
3. What happens when outputs are malformed or unsafe?
4. Can the system synthesize a best answer without escalating to autonomous
   behavior?
5. If agent routing is requested, did the caller explicitly opt in?

That makes `direct` the production-ready path. `agent_chat` remains
launch-blocked until an end-to-end real SafeLoop repo-mutation smoke passes.

## Comparison framing against prompt routers

Prompt routers often focus on choosing a model or prompt path.

QuorumRouter frames routing as a runtime safety boundary:

- adapters return structured outputs;
- validation is part of the route;
- synthesis is explicit;
- failures are fail-closed;
- read-only conversation routing is gated, not implicit.

The goal is not only “pick a model.” The goal is to make the route inspectable
and bounded.

## Launch narrative

QuorumRouter current release is ready for external evaluation through the public
NPX scaffold:

```bash
npx --yes create-quorum-router@latest my-quorum-router-demo
cd my-quorum-router-demo
deno task smoke
```

The npm package is `create-quorum-router@0.1.4` (`latest -> 0.1.4`). Version
`0.1.4` is an engineering NPX scaffold / generated-demo compatibility patch in
the current release line, not a separate product milestone.

The release is deliberately narrow: prove the public path, explain the safety
boundaries, and give builders a readable generated demo.

## “Routing first, agents second” explanation

A routing framework should not require autonomous agents to be useful.

In QuorumRouter:

- `direct` handles production-ready best-answer routing.
- `agent_chat` is available only as read-only explicit opt-in.
- no hidden fallback turns an invalid route into an unsafe route.
- no production autonomous runtime is claimed.

The agent story is intentionally behind the routing story. That keeps the Public
RC useful for builders who want reliable adapter routing today while preserving
a clear path for future explicit agent experiments.

## Safety boundary

The current release safety boundary is:

- `direct` remains the production-ready best-answer routing path.
- Conversation-only `agent_chat` remains explicit opt-in.
- SafeLoop-backed repo/shell mutation is supported only for the verified local
  execution slice after approval/preflight capability and smoke gates pass.
- SafeLoop-backed AgentRuntime production claims are limited to the verified
  local repository execution slice with signed policy and distinct approval.
- No live Supabase Agent Bus runtime writes.
- No service-role runtime.
- No full multi-agent production-system claim.
- No hidden runtime expansion from the NPX scaffold.

## License boundary

QuorumRouter is Source-Available Non-Commercial.

This is not an open source license.

Commercial, production, hosted-service/SaaS/API, redistribution, sublicensing,
integration, derivative commercialization, or competing product/service use
requires prior written permission.

Personal evaluation, academic or non-commercial research, and non-production
testing are the intended evaluation allowances under the license terms.
