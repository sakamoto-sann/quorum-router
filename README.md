# QuorumRouter

Source-available Deno routing framework for fail-closed best-answer routing and
experimental, SafeLoop-authorized action proposals.

## Quickstart

```bash
npx --yes create-quorum-router@latest my-quorum-router-demo
cd my-quorum-router-demo
deno task smoke
```

NPX is not the goal. `deno task smoke` is deterministic fixture-only and does
**not** call a real external provider API. Public Product Hunt/X launch requires
local real-model dogfood first: the user must personally confirm that
QuorumRouter can discover and invoke the models actually available from this
machine's existing OAuth, wrapper, CLI session, or explicitly selected env
fallback setup. Generic API-key env fallback is private/manual only and is not
the primary launch proof.

Repo-local dogfood workspace:

```bash
cd examples/local-model-dogfood
deno task inventory
deno task auth:status
deno task health
RUN_EXTERNAL_MODEL_DOGFOOD=1 deno task route:once --prompt "Review this README for risky claims."
RUN_EXTERNAL_MODEL_DOGFOOD=1 deno task best-route --prompt "Choose the safest launch copy."
RUN_EXTERNAL_MODEL_DOGFOOD=1 RUN_EXPERIMENTAL_AGENT_CHAT=1 deno task agent-chat --prompt "Review this launch plan."
```

Best Route/direct remains the production best-answer path. Agent Chat is an
explicit experimental mode. Its coder emits structured proposals, and an
injected SafeLoop client is the sole execution authority. The current real
SafeLoop execute-request API requires a pre-issued distinct-actor approval bound
to the exact canonical digest for every repo or shell write. QuorumRouter does
not approve or sign policy and accepts only a strictly verified SafeLoop v1
receipt.

Dry-run the installer without changing the machine:

```bash
curl -fsSL https://raw.githubusercontent.com/sakamoto-sann/fusion-router/v0.1.4/install.sh | sh -s -- --dry-run
```

## Demos

### GIF 1 — Best Route mode

Best Route mode chooses the best answer path. It does not run the Agent Chat
conversation loop.

![QuorumRouter Best Route mode demo](docs/assets/launch/fusion-router-best-route-game.gif)

MP4 fallback:
[Best Route demo](docs/assets/launch/fusion-router-best-route-game.mp4)

### GIF 2 — Agent Chat mode

Agent Chat execution is explicit and separate from Best Route mode.

![QuorumRouter Agent Chat mode demo](docs/assets/launch/fusion-router-agent-chat-game.gif)

MP4 fallback:
[Agent Chat demo](docs/assets/launch/fusion-router-agent-chat-game.mp4)

## Modes

| Mode                      | Status                    | Purpose                              |
| ------------------------- | ------------------------- | ------------------------------------ |
| Best Route / direct       | Production-ready path     | Best-answer routing                  |
| agent_chat (conversation) | Explicit read-only mode   | Multi-role review conversation       |
| agent_chat (execution)    | Launch-blocked experiment | SafeLoop-authorized action proposals |

Agent Chat and Commander contracts do not change default direct routing.

## Local checks

```bash
deno task fmt
deno task check
deno task test
deno task smoke:v0.1
```

## Links

- npm: https://www.npmjs.com/package/create-quorum-router
- release: https://github.com/sakamoto-sann/fusion-router/releases/tag/v0.1.4
- launch assets: [docs/launch/](docs/launch/)
- internal dogfood QA:
  [docs/dogfood/manual-qa-runbook.md](docs/dogfood/manual-qa-runbook.md)
- Hermes Agent on-demand integration:
  [integrations/hermes/](integrations/hermes/)
- examples: [examples/](examples/)
- security notes: [docs/security.md](docs/security.md)

## License and boundaries

QuorumRouter is Source-Available Non-Commercial. It is not an open source
license.

Commercial, production, hosted-service/SaaS/API, redistribution, sublicensing,
integration, derivative commercialization, or competing product/service use
requires prior written permission. See [LICENSE](LICENSE).

QuorumRouter does not contain an autonomous executor, policy engine, audit WAL,
artifact verifier, or rollback engine. Execution receipts and artifact evidence
must come from the injected SafeLoop authority. GitHub, database, external API,
release, policy, and credential mutations remain unsupported. Repo and shell
mutations are available only through the SafeLoop execute-request authority and
the confined structured-action worker. There are no live Supabase Agent Bus
runtime writes and no service-role runtime.
