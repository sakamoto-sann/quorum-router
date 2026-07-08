# Install Fusion Router

External launch label: **Fusion Router v0.1 Public RC**.

Fusion Router is **Source-Available Non-Commercial**. This is **not open
source**. Commercial, production, hosted-service/SaaS/API, redistribution,
sublicensing, integration, derivative commercialization, or competing
product/service use requires prior written permission.

## Security boundaries

- `direct` is the production-ready best-answer routing path.
- `agent_chat` is experimental explicit opt-in.
- No production autonomous runtime is installed or enabled.
- No service-role runtime is configured.
- No live Supabase Agent Bus runtime writes are configured.
- No Supabase Realtime subscriber is installed.
- The install helper does not ask for credentials, write secrets, enable process
  adapters, or configure live runtime services.

## Git clone quickstart

```bash
git clone https://github.com/sakamoto-sann/fusion-router.git
cd fusion-router
deno task smoke:v0.1
```

## Scaffold an evaluation demo with npx

```bash
npx --yes create-fusion-router@latest my-fusion-router-demo
cd my-fusion-router-demo
deno task smoke
```

npm package: `create-fusion-router@0.1.4`; npm dist-tag: `latest -> 0.1.4`. For
a fixed package version:

```bash
npx --yes create-fusion-router@0.1.4 my-fusion-router-demo
cd my-fusion-router-demo
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

The helper clones the tagged repository into `${PREFIX}/share/fusion-router` and
writes `${PREFIX}/bin/fusion-router`.

Wrapper commands:

```bash
fusion-router doctor
fusion-router smoke
fusion-router test
```

The helper fails clearly if the requested ref is unavailable. For local
source-tree evaluation only, pass an explicit ref:

```bash
sh install.sh --dry-run --ref main
```

Stable usage should use the tagged `v0.1.4` URL, not raw `main`.

## Uninstall

```bash
rm -rf "$HOME/.local/share/fusion-router"
rm -f "$HOME/.local/bin/fusion-router"
```

Adjust the paths if you installed with a different `--prefix`.

## Troubleshooting

- `missing required tool: git`: install Git and retry.
- `missing required tool: deno`: install Deno and retry.
- Clone or checkout errors for `v0.1.4`: verify network access and the ref
  spelling.
- `fusion-router: command not found`: add `${PREFIX}/bin` to your shell `PATH`.
- Scaffold `deno task smoke` is offline/fixture-only. If it fails, check local
  Deno install / permissions first; do not debug `raw.githubusercontent.com` for
  smoke. Network is only required for install-helper clone and optional external
  provider dogfood (`RUN_EXTERNAL_MODEL_DOGFOOD=1`).
