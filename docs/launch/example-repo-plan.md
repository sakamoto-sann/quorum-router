# Example repo plan — Fusion Router v0.1 Public RC

> Proposal only. Do not create a repository unless explicitly approved.

## Proposed repo name

`fusion-router-public-rc-demo`

Alternative names:

- `fusion-router-v0-1-public-rc-demo`
- `create-fusion-router-demo`
- `fusion-router-direct-demo`

## Purpose

A small separate repository that mirrors the public NPX quickstart and gives
evaluators a static place to browse the generated demo files.

The repo should not become a second source of truth for release state. It should
point back to:

- GitHub release:
  https://github.com/sakamoto-sann/fusion-router/releases/tag/v0.1.3
- npm package: https://www.npmjs.com/package/create-fusion-router
- main repository: https://github.com/sakamoto-sann/fusion-router

## README structure

1. Title: `Fusion Router v0.1 Public RC demo`
2. License warning: Source-Available Non-Commercial, not open source.
3. Runtime boundaries:
   - `direct` production-ready best-answer path.
   - `agent_chat` experimental explicit opt-in only.
   - no production autonomous runtime.
   - no live Supabase Agent Bus runtime writes.
   - no service-role runtime.
4. Quickstart.
5. Generated files overview.
6. Expected output.
7. Links to upstream release, npm package, and docs.
8. Maintenance notes.

## Files

If approved, create only:

```text
README.md
deno.json
main.ts
.gitignore
```

Optional later files:

```text
docs/output-example.md
docs/recording-notes.md
```

## Commands

Recommended README quickstart:

```bash
npx --yes create-fusion-router@latest my-fusion-router-demo
cd my-fusion-router-demo
deno task check
deno task smoke
```

If this repo checks in generated files directly, use:

```bash
deno task check
deno task smoke
```

## Expected demo output

`deno task smoke` should complete with JSON containing:

```json
{
  "ok": true
}
```

The generated demo may also print the release-tagged source URL and
deterministic fixture adapter/synthesis metadata.

## License caveat

The example repo must repeat the same boundary:

Fusion Router is Source-Available Non-Commercial. This is not open source.

Commercial, production, hosted-service/SaaS/API, redistribution, sublicensing,
integration, derivative commercialization, or competing product/service use
requires prior written permission.

Do not add an MIT, Apache, GPL, or other open source license to the example repo
unless the upstream license decision changes explicitly.

## Maintenance checklist

Before creating or updating the example repo:

- [ ] Confirm upstream npm latest still points to the intended version.
- [ ] Confirm `create-fusion-router@0.1.3` remains available.
- [ ] Run the NPX quickstart in a clean temp directory.
- [ ] Copy generated files only if they match the intended demo.
- [ ] Run `deno task check`.
- [ ] Run `deno task smoke`.
- [ ] Confirm output contains `"ok": true`.
- [ ] Confirm license and runtime boundary language matches upstream docs.
- [ ] Confirm no tokens, passwords, OTPs, API keys, or service-role credentials
      are committed.
- [ ] Link to the upstream release and npm package.

## When to create it

Create this repo only after explicit approval when one of these is true:

- a public launch needs a static browsable demo repo;
- a social post needs a clean example repository link separate from the main
  repo;
- Product Hunt or another listing needs a simplified demo surface;
- the upstream generated demo is stable enough that a mirrored example will not
  create maintenance churn.

Do not create it as part of the launch-assets PR.
