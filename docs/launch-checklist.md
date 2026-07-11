# QuorumRouter v0.1 public preview launch checklist

Use this checklist before external announcements or operational usage of the
**QuorumRouter v0.1 public preview** line.

## 1. GitHub release readback

- [ ] `git fetch --tags --prune`
- [ ] `git rev-parse HEAD`
- [ ] `git rev-parse origin/main`
- [ ] `git rev-parse v0.1.4^{}`
- [ ] `gh release view v0.1.4 --json tagName,targetCommitish,isDraft,isPrerelease,publishedAt,url`
- [ ] Confirm `v0.1.4^{}` equals the intended public preview commit.
- [ ] Confirm the release is not draft.
- [ ] Confirm the release URL is reachable.

## 2. npm readback

- [ ] `npm view create-quorum-router@0.1.4 name version license bin dist.tarball --json`
- [ ] `npm dist-tag ls create-quorum-router`
- [ ] Confirm package name: `create-quorum-router`.
- [ ] Confirm package version: `0.1.4`.
- [ ] Confirm package metadata license: `MIT`.
- [ ] Confirm bin: `create-quorum-router -> bin/create-quorum-router.js`.
- [ ] Confirm `latest -> 0.1.4`.

## 3. NPX smoke

- [ ] Create a clean temp directory.
- [ ] Run:

```bash
npx --yes create-quorum-router@latest my-quorum-router-demo
cd my-quorum-router-demo
deno task check
deno task smoke
```

- [ ] Confirm generated scaffold includes at least:

```text
./README.md
./deno.json
./main.ts
./src/context.ts
./src/cli.ts
```

Full package contents are gated by the create-quorum-router tarball whitelist in
`publish.yml` / `deno task test` (27 pack entries for 0.1.4).

- [ ] Confirm `deno task check` passes.
- [ ] Confirm `deno task smoke` passes.
- [ ] Confirm smoke output includes `"ok": true`.

## 4. README quickstart

- [ ] Top public quickstart uses:

```bash
npx --yes create-quorum-router@latest my-quorum-router-demo
cd my-quorum-router-demo
deno task smoke
```

- [ ] Fixed quickstart uses `create-quorum-router@0.1.4`.
- [ ] README labels the external line as **QuorumRouter v0.1 public preview**.
- [ ] README states `0.1.4` is an engineering NPX scaffold / generated-demo
      compatibility patch, not a separate product milestone.

## 5. Product Hunt copy check

- [ ] Product Hunt copy uses the external label **QuorumRouter v0.1 public
      preview**.
- [ ] Copy says MIT.
- [ ] Copy says open source.
- [ ] Copy does not imply production autonomous runtime.
- [ ] Copy does not imply commercial/production/SaaS/API use is allowed without
      permission.

## 6. License check

- [ ] README license section says MIT.
- [ ] README says this is open source.
- [ ] Package README says MIT.
- [ ] Generated template README says MIT.
- [ ] Commercial and production use are permitted under the MIT License.

## 7. Security boundary check

- [ ] `direct` remains the production-ready best-answer routing path.
- [ ] `agent_chat` remains experimental explicit opt-in only.
- [ ] No production autonomous runtime.
- [ ] No live Supabase Agent Bus runtime writes.
- [ ] No Supabase Realtime subscriber.
- [ ] No service-role runtime.
- [ ] No npm token, password, OTP, or temporary npmrc is committed.

## 8. No unwanted runtime expansion

- [ ] No production broker/live execution behavior added.
- [ ] No hidden fallback added.
- [ ] No automatic OAuth/API-key setup added.
- [ ] No new service-role runtime path added.

## 9. No tag/release mutation

- [ ] Do not move, delete, or recreate `v0.1.0`.
- [ ] Do not move, delete, or recreate `v0.1.1`.
- [ ] Do not move, delete, or recreate `v0.1.2`.
- [ ] Do not move, delete, or recreate `v0.1.3`.
- [ ] Do not move, delete, or recreate `v0.1.4`.
- [ ] Create a new tag only after explicit version approval.

## 10. No npm dist-tag mutation unless explicitly approved

- [ ] Do not run `npm dist-tag add`, `npm dist-tag rm`, or equivalent registry
      mutation unless explicitly approved.
- [ ] Readback with `npm dist-tag ls create-quorum-router` is safe.
- [ ] For this public preview closeout, expected readback remains
      `latest: 0.1.4`.
