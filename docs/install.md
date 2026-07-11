# Install QuorumRouter

External launch label: **QuorumRouter v0.1 public preview**.

QuorumRouter is **MIT-licensed open source**. Commercial and production use are
permitted under the MIT License.

## Security boundaries

- `direct` is the production-ready best-answer routing path.
- Conversation-only `agent_chat` is explicit opt-in.
- Production autonomous repository execution is not installed or enabled by this
  helper; it requires a separately configured SafeLoop authority, signed policy,
  distinct approval, and confined action runner.
- No service-role runtime is configured.
- No live Supabase Agent Bus runtime writes are configured.
- No Supabase Realtime subscriber is installed.
- The install helper does not ask for credentials, write secrets, enable process
  adapters, or configure live runtime services.

## Git clone quickstart

```bash
git clone https://github.com/sakamoto-sann/quorum-router.git
cd quorum-router
deno task smoke:v0.1
```

## Scaffold an evaluation demo with npx

```bash
npx --yes create-quorum-router@latest my-quorum-router-demo
cd my-quorum-router-demo
deno task smoke
```

npm package: `create-quorum-router@0.1.4`; npm dist-tag: `latest -> 0.1.4`. For
a fixed package version:

```bash
npx --yes create-quorum-router@0.1.4 my-quorum-router-demo
cd my-quorum-router-demo
deno task smoke
```

The scaffold does not fetch remote code during creation and does not install
dependencies automatically. `0.1.4` is an engineering patch for the NPX scaffold
and generated-demo compatibility, not a separate product milestone. The
generated `deno task smoke` path is offline/fixture-only and does not call a
provider API or `raw.githubusercontent.com`.

## Install helper dry run

For the tagged v0.1.4 install helper, inspect the install plan first:

```bash
curl -fsSL https://raw.githubusercontent.com/sakamoto-sann/fusion-router/v0.1.4/install.sh | sh -s -- --dry-run
```

## Install helper actual install

```bash
curl -fsSL https://raw.githubusercontent.com/sakamoto-sann/fusion-router/v0.1.4/install.sh | sh -s -- --prefix "$HOME/.local"
```

The helper clones the tagged repository into `${PREFIX}/share/quorum-router` and
writes `${PREFIX}/bin/quorum-router`.

Wrapper commands:

```bash
quorum-router doctor
quorum-router smoke
quorum-router test
```

The helper fails clearly if the requested ref is unavailable. For local
source-tree evaluation only, pass an explicit ref:

```bash
sh install.sh --dry-run --ref main
```

Stable usage should use the tagged `v0.1.4` URL, not raw `main`.

## Uninstall

```bash
rm -rf "$HOME/.local/share/quorum-router"
rm -f "$HOME/.local/bin/quorum-router"
```

Adjust the paths if you installed with a different `--prefix`.

## Troubleshooting

- `missing required tool: git`: install Git and retry.
- `missing required tool: deno`: install Deno and retry.
- Clone or checkout errors for `v0.1.4`: verify network access and the ref
  spelling.
- `quorum-router: command not found`: add `${PREFIX}/bin` to your shell `PATH`.
- Scaffold `deno task smoke` is offline/fixture-only. If it fails, check local
  Deno install / permissions first; do not debug `raw.githubusercontent.com` for
  smoke. Network is only required for install-helper clone and optional external
  provider dogfood (`RUN_EXTERNAL_MODEL_DOGFOOD=1`).
