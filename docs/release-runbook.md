# QuorumRouter release runbook

QuorumRouter is a public MIT-licensed product. This runbook verifies the current
release and its production boundaries.

## Public quickstart

```bash
npx --yes create-quorum-router@latest my-quorum-router
cd my-quorum-router
deno task check
deno task smoke
```

Pin a release only when reproducibility requires it:

```bash
npx --yes create-quorum-router@0.1.19 my-quorum-router
```

## Release readback

```bash
npm view create-quorum-router version dist-tags dist.integrity dist.attestations --json
gh release view v0.1.19 --repo sakamoto-sann/quorum-router
git ls-remote --tags origin refs/tags/v0.1.19
```

The npm version, `latest` dist-tag, GitHub Release, source tag, and SLSA
provenance must agree before a release is reported as verified. Tag and GitHub
Release point at the intended commit.

## Runtime boundaries

- Direct mode is the production fail-closed multi-model routing path.
- AgentRuntime is production-capable only when a real execution authority is
  injected. The supported authority is SafeLoop's approved machine-readable
  execution API.
- Conversation-only Agent Chat without an execution authority remains explicit
  opt-in and must not be described as production execution.
- Task calibration accepts caller-attested external evaluation evidence. Its
  report is diagnostic and does not silently authorize provider selection or
  execution.
- QuorumRouter is a local library/scaffold, not a hosted autonomous-agent
  service. It performs no central service-role runtime writes.

## Release gates

1. Scan public repository metadata and every tracked file for stale launch
   terms.
2. Run formatting, lint, type checks, frozen-lock checks, unit tests, and smoke.
3. Run the real SafeLoop execution E2E with `SAFELOOP_E2E_REQUIRED=1`.
4. Run live provider calls for every provider claimed ready in release copy.
5. Run an independent P0/P1/P2 Red Team over the whole release, not only the
   diff.
6. Scan the exact outgoing diff and all release text for secrets.
7. Merge reviewed code before creating the immutable source tag.
8. Publish through npm Trusted Publishing and verify provenance from the
   registry.
9. Generate a clean NPX workspace from the public package and exercise it.
