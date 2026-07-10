# Fusion Router v0.1 runbook

Fusion Router v0.1 is the public release line for Fusion Router's fail-closed
best-answer routing work. The live external label is **Fusion Router v0.1**.

`create-fusion-router@0.1.4` is the first live NPX package version for this v0.1
release line. Version `0.1.4` is an engineering NPX scaffold / generated-demo
compatibility patch, not a separate product milestone.

## Public quickstart

```bash
npx --yes create-fusion-router@latest my-fusion-router-demo
cd my-fusion-router-demo
deno task smoke
```

Current npm readback: `create-fusion-router@latest -> 0.1.4`.

## Fixed version quickstart

```bash
npx --yes create-fusion-router@0.1.4 my-fusion-router-demo
cd my-fusion-router-demo
deno task smoke
```

Use the fixed version when you want to reproduce the exact scaffold package used
by this closeout.

## Expected successful output

The scaffold command should create exactly these files:

```text
./README.md
./deno.json
./main.ts
```

`deno task check` should type-check `main.ts`.

`deno task smoke` should print a JSON object containing:

```json
{
  "ok": true
}
```

The generated smoke imports Fusion Router from the published GitHub release-tag
URL at runtime, so it requires network access to `raw.githubusercontent.com`.

## Troubleshooting

### Missing Deno

If `deno task check` or `deno task smoke` fails with `deno: command not found`,
install Deno from the official Deno installation instructions, then rerun:

```bash
deno task check
deno task smoke
```

Do not use `curl | sh` from this runbook. Prefer the official installer package,
Homebrew, or another trusted package manager for your platform.

### npm / npx cache issue

If `npx --yes create-fusion-router@latest ...` appears to use an older package,
verify the registry state:

```bash
npm view create-fusion-router@0.1.4 name version license bin dist.tarball --json
npm dist-tag ls create-fusion-router
```

Expected:

```text
latest: 0.1.4
```

Then retry with the fixed version command:

```bash
npx --yes create-fusion-router@0.1.4 my-fusion-router-demo
```

### Network issue to raw.githubusercontent.com

If scaffolding succeeds but `deno task smoke` fails during remote import, check
whether the current network can reach `raw.githubusercontent.com`. The generated
smoke intentionally imports the public release-tagged runtime file over HTTPS
during execution; scaffolding itself does not download runtime code.

### Deno import map / zod resolution

If Deno reports an import-resolution error for `zod`, confirm you are running
inside the generated demo directory and that `deno.json` is present. The
generated demo includes an import map entry for `zod` so the remote
release-tagged `router.ts` can resolve its schema dependency.

```bash
pwd
find . -maxdepth 1 -type f | sort
deno task check
```

Expected files in the generated demo root:

```text
./README.md
./deno.json
./main.ts
```

## Runtime boundaries

No routing behavior changes are implied by this v0.1 release runbook.

- `direct` remains the production-ready best-answer routing path.
- `agent_chat` remains experimental explicit opt-in only.
- No production autonomous runtime.
- No live Supabase Agent Bus runtime writes.
- No Supabase Realtime subscriber.
- No service-role runtime.
- No broker/live execution behavior.

## License boundary

Fusion Router is **open source under the MIT License**.

The MIT License permits use, modification, distribution, sublicensing, and sale.
See [`../LICENSE`](../LICENSE) for the authoritative terms and notice
requirements.
