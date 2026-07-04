# Launch readiness report — Fusion Router v0.1 Public RC

Prepared for external launch asset closeout.

## Release identity

- External label: **Fusion Router v0.1 Public RC**
- GitHub release: `v0.1.3`
- GitHub release URL:
  https://github.com/sakamoto-sann/fusion-router/releases/tag/v0.1.3
- npm package: `create-fusion-router`
- npm package URL: https://www.npmjs.com/package/create-fusion-router
- npm latest target: `0.1.3`

`0.1.3` is an engineering NPX scaffold / generated-demo compatibility patch in
the v0.1 Public RC line, not a separate product milestone.

## GitHub release readback

Expected release readback:

```json
{
  "tagName": "v0.1.3",
  "targetCommitish": "34398e6bfa0796d76cfb84c564dd00f7dd84afe7",
  "isDraft": false,
  "isPrerelease": false,
  "url": "https://github.com/sakamoto-sann/fusion-router/releases/tag/v0.1.3"
}
```

Expected tag dereference:

```text
v0.1.3^{} = 34398e6bfa0796d76cfb84c564dd00f7dd84afe7
```

This launch-assets PR must not move, delete, or recreate `v0.1.0`, `v0.1.1`,
`v0.1.2`, or `v0.1.3`.

## npm readback

Expected package readback:

```json
{
  "name": "create-fusion-router",
  "version": "0.1.3",
  "license": "SEE LICENSE IN LICENSE",
  "bin": {
    "create-fusion-router": "bin/create-fusion-router.js"
  },
  "dist.tarball": "https://registry.npmjs.org/create-fusion-router/-/create-fusion-router-0.1.3.tgz"
}
```

Expected dist-tag readback:

```text
latest: 0.1.3
```

This launch-assets PR must not publish npm, bump the package version, create
`0.1.4`, or mutate npm dist-tags.

## NPX smoke status

Public quickstart:

```bash
npx --yes create-fusion-router@latest my-fusion-router-demo
cd my-fusion-router-demo
deno task smoke
```

Expected generated files:

```text
./README.md
./deno.json
./main.ts
```

Expected verification:

- scaffold passes.
- generated demo `deno task check` passes.
- generated demo `deno task smoke` passes.
- smoke output contains `"ok": true`.

## Docs status

Operational docs already exist:

- `docs/public-rc-runbook.md`
- `docs/trusted-publishing.md`
- `docs/launch-checklist.md`

Launch assets in this set:

- `docs/launch/product-hunt-copy.md`
- `docs/launch/x-launch-thread.md`
- `docs/launch/demo-script.md`
- `docs/launch/demo-gif-shotlist.md`
- `docs/launch/example-repo-plan.md`
- `docs/launch/faq.md`
- `docs/launch/positioning.md`
- `docs/launch/launch-readiness-report.md`

## Workflow readiness

Publish workflow status: hardened and ready, not run.

Expected readiness properties:

- no ordinary `push` to `main` publish trigger.
- explicit release tag input or deliberate release-tag push condition.
- `permissions.contents: read`.
- GitHub Actions OIDC id-token permission is enabled for Trusted Publishing.
- npm registry URL configured for Trusted Publishing.
- no committed npm token, password, or OTP.
- no publish workflow invocation during launch-assets preparation.

## Runtime and license boundaries

- `direct` is the production-ready best-answer routing path.
- `agent_chat` is experimental explicit opt-in only.
- No production autonomous runtime.
- No live Supabase Agent Bus runtime writes.
- No service-role runtime.
- Fusion Router is Source-Available Non-Commercial.
- This is not an open source license.
- Commercial, production, hosted-service/SaaS/API, redistribution, sublicensing,
  integration, derivative commercialization, or competing product/service use
  requires prior written permission.

## Launch blockers

Current expected blocker state: none, subject to the final PR verification and
CI readback.

Do not launch externally if any of these become true:

- GitHub release/tag readback differs from the expected `v0.1.3` state.
- npm latest no longer resolves to `0.1.3` unexpectedly.
- NPX smoke fails.
- docs stop saying the license is not open source.
- docs stop preserving the no-production-autonomous-runtime boundary.
- docs stop preserving the no-live-Supabase-runtime-writes boundary.
- docs stop preserving the no-service-role-runtime boundary.
- publish workflow was run unintentionally.
- npm publish, version bump, tag/release mutation, or dist-tag mutation occurred
  without explicit approval.

## Final launch checklist

- [ ] GitHub release `v0.1.3` read back.
- [ ] `v0.1.3^{}` target read back.
- [ ] npm package `create-fusion-router@0.1.3` read back.
- [ ] npm `latest -> 0.1.3` read back.
- [ ] NPX latest smoke passes.
- [ ] generated demo `deno task check` passes.
- [ ] generated demo `deno task smoke` passes.
- [ ] launch assets reviewed.
- [ ] Product Hunt listing not created automatically.
- [ ] X posts not posted automatically.
- [ ] demo GIF/video not created automatically.
- [ ] example repo not created automatically.
- [ ] no npm publish.
- [ ] no package version bump.
- [ ] no npm dist-tag mutation.
- [ ] no tag/release mutation.
- [ ] license/runtime boundaries preserved.
