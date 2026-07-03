# Install Fusion Router

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
npx create-fusion-router@latest my-fusion-router-demo
cd my-fusion-router-demo
deno task check
deno task smoke
```

The scaffold does not fetch remote code during creation and does not install
dependencies automatically. The generated smoke task imports Fusion Router from
the published `v0.1.2` Git tag at runtime, so it requires network access to
`raw.githubusercontent.com` and the release tag must exist.

## Install helper dry run

After v0.1.2 is published, inspect the install plan first:

```bash
curl -fsSL https://raw.githubusercontent.com/sakamoto-sann/fusion-router/v0.1.2/install.sh | sh -s -- --dry-run
```

## Install helper actual install

```bash
curl -fsSL https://raw.githubusercontent.com/sakamoto-sann/fusion-router/v0.1.2/install.sh | sh -s -- --prefix "$HOME/.local"
```

The helper clones the tagged repository into `${PREFIX}/share/fusion-router` and
writes `${PREFIX}/bin/fusion-router`.

Wrapper commands:

```bash
fusion-router doctor
fusion-router smoke
fusion-router test
```

If the `v0.1.2` tag does not exist yet, the helper fails clearly. For
pre-release evaluation only, pass an explicit ref:

```bash
sh install.sh --dry-run --ref main
```

Stable usage should use the tagged `v0.1.2` URL, not raw `main`.

## Uninstall

```bash
rm -rf "$HOME/.local/share/fusion-router"
rm -f "$HOME/.local/bin/fusion-router"
```

Adjust the paths if you installed with a different `--prefix`.

## Troubleshooting

- `missing required tool: git`: install Git and retry.
- `missing required tool: deno`: install Deno and retry.
- Clone or checkout errors for `v0.1.2`: the release tag is not published yet,
  or the ref is misspelled.
- `fusion-router: command not found`: add `${PREFIX}/bin` to your shell `PATH`.
- Network failures during `deno task smoke` in the scaffold usually mean
  `raw.githubusercontent.com` is unreachable or the `v0.1.2` tag has not been
  published yet.
