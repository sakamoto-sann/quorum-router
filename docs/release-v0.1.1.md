# QuorumRouter v0.1.1

## Status

First AgentRuntime release.

## Summary

v0.1.1 is the first QuorumRouter release with an explicit opt-in experimental
AgentRuntime path.

## What changed since v0.1.0

- Experimental AgentRuntime added.
- `agent_chat` is no longer only a skeleton.
- `agent_chat` can execute only with explicit `experimentalAgentRuntime=true`
  and enabled AgentRuntime config.
- Runtime loop:
  - commander
  - coder
  - reviewer
  - red_team
  - closeout
- Runtime produces transcript, Agent Bus messages/events, decision, and final
  answer.
- Runtime fail-closed boundaries added:
  - missing opt-in
  - missing runtime config
  - missing required role
  - duplicate role binding
  - malformed role JSON
  - unsafe role status
  - unsafe objection
  - unsafe finalAnswer placement
  - prompt too large
  - timeout / abort
  - budget exceeded
  - unsafe closeout with objections
- CI checks added.
- The project is licensed under MIT for this AgentRuntime release.

## Routing modes

### direct

Production-ready best-answer routing path.

### agent_chat

Experimental, explicit opt-in only.

Required:

- `routingMode: "agent_chat"`
- `experimentalAgentRuntime: true`
- enabled AgentRuntime config
- explicit AgentBusStore
- explicit per-run `busIds.teamId` and `busIds.runId`

## AgentRuntime scope

Included:

- in-process experimental runtime
- deterministic local examples
- in-memory Agent Bus store support
- strict role JSON parser
- transcript/messages/events/finalAnswer output
- smoke coverage

Not included:

- production autonomous runtime
- live Supabase Agent Bus runtime client/writes
- Supabase Realtime subscriber
- worker process spawning
- external tool execution
- OAuth/login flow
- local model runtime implementation
- service-role runtime

## License

QuorumRouter is MIT.

This is an OSI-approved open source license.

Permitted under MIT:

- use, modification, and distribution
- commercial and production use
- hosted-service/SaaS/API integration
- sublicensing and derivative works, subject to the MIT notice requirement

## Verification target

Release target commit: `c6e0518824487a1d270edf8ec1ce326c330173fd`

Expected verification:

- `deno task lock:check`
- `deno task check`
- `deno task lint`
- `deno task test`
- `deno task doctor`
- `deno task smoke:v0.1`
- `gitleaks`

Expected results:

- tests: `201 passed | 0 failed`
- doctor: `ok: true`
- smoke:v0.1: `ok: true`
- AgentRuntime smoke:
  - `{"decision":"ready","ok":true,"turns":5}`
- gitleaks: no leaks found

## Release rule

Do not publish unless:

- main HEAD matches intended release target
- CI is green
- local full verification is green
- license readback confirms MIT
- existing v0.1.0 is left unchanged
