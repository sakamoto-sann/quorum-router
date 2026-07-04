# create-fusion-router

Create a local Fusion Router evaluation demo.

Fusion Router is **Source-Available Non-Commercial**. This is **not open
source**. Commercial, production, hosted-service/SaaS/API, redistribution,
sublicensing, integration, derivative commercialization, or competing
product/service use requires prior written permission.

## Usage

```bash
npx --yes create-fusion-router@latest my-fusion-router-demo
cd my-fusion-router-demo
deno task smoke
```

`create-fusion-router@latest` is live on npm and currently resolves to `0.1.3`.
For a fixed package version:

```bash
npx --yes create-fusion-router@0.1.3 my-fusion-router-demo
cd my-fusion-router-demo
deno task smoke
```

External launch label: **Fusion Router v0.1 Public RC**. `0.1.3` is an
engineering patch for NPX scaffold / generated-demo compatibility, not a
separate product milestone.

The scaffold copies a deterministic demo template only. It does not fetch remote
code during scaffolding, install dependencies, ask for credentials, write
secrets, enable process adapters, or configure Supabase service-role/runtime
access.

The generated `smoke` task imports the public Fusion Router entrypoint from the
published `v0.1.2` Git tag at runtime. That network access is explicit in the
generated `deno.json` permission (`--allow-net=raw.githubusercontent.com`).
v0.1.2 is the GitHub security hardening release used by the generated demo; npm
package users should use `create-fusion-router@latest` or
`create-fusion-router@0.1.3`.

## CLI

```bash
create-fusion-router <dir>
create-fusion-router <dir> --template basic
create-fusion-router <dir> --force
create-fusion-router --help
create-fusion-router --version
```

The CLI refuses to overwrite a non-empty directory unless `--force` is passed.
