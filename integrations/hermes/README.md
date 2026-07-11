# QuorumRouter for Hermes Agent

This standalone Hermes plugin exposes QuorumRouter as an **on-demand tool**, not
as Hermes' primary model provider. That preserves Hermes tool calling and prompt
caching while allowing selective real-provider dogfood.

## Tools

- `quorum_router_health` — local provider inventory; never sends a generation
  call.
- `quorum_router_route` — `route_once` by default, optional `best_route`
  comparison.
- `quorum_router_agent_chat` — bounded live dialogue between at least two
  distinct working provider/model identities. Returns every round with explicit
  reply lineage; `max_turns` is constrained to 2–12.

The bridge sends JSON over stdin so prompt text does not appear in the child
process command line. Provider credentials are not copied into plugin config;
QuorumRouter uses existing local CLI OAuth/session state. The plugin passes a
small non-secret environment allowlist and resolves provider executables to
absolute paths before granting Deno `--allow-run` permission.

## Install from a checkout

```bash
mkdir -p ~/.hermes/plugins/quorum-router
cp integrations/hermes/{plugin.yaml,__init__.py,tools.py} ~/.hermes/plugins/quorum-router/
printf '{"repo_path":"%s"}\n' "$PWD" > ~/.hermes/plugins/quorum-router/config.json
hermes plugins enable quorum-router
```

Restart the Hermes gateway or start a fresh CLI session after enabling the
plugin. Keep `route_once` as the normal trial mode; `best_route` may call
several providers and should be used only when comparison value justifies the
cost.

Example request from Hermes:

```text
Use quorum_router_agent_chat with max_turns=4 to have two models debate this
architecture and return the transcript plus a concise conclusion.
```

## Boundaries

- Do not route prompts containing API keys, passwords, tokens, or raw private
  datasets.
- This integration is text-only. QuorumRouter provider CLIs do not inherit
  Hermes tools, files, browser state, or conversation history.
- The bridge persists only QuorumRouter's existing redacted trace summaries; raw
  provider answers are returned to the current Hermes turn and are not written
  by the bridge.
- During the trial, the plugin keeps a local `0600` `trial-telemetry.jsonl`
  containing only timestamp, route/provider/model labels, success, latency,
  candidate count, and truncation state. It never stores prompts or answers. Set
  `"telemetry_enabled": false` in `config.json` to disable this local log.
- Disable instantly with `hermes plugins disable quorum-router`.
