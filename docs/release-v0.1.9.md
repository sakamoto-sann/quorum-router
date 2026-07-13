# QuorumRouter v0.1.9

QuorumRouter v0.1.9 is a release-integrity hotfix for the v0.1.8 calibration
release.

## Fixes

- Change the source installer default from stale `v0.1.6` to `v0.1.9`.
- Add a regression test that runs `sh install.sh --dry-run` without `--ref` and
  verifies the current release tag.
- Correct the Calibration demo boundary: it makes no provider/API calls, but a
  fresh Deno cache resolves the pinned Zod dependency before the first run.
- Update current package, installer, quickstart, scaffold, and release-link
  surfaces to `0.1.9`.

## Preserved behavior

- Calibration remains deterministic and `advisory_only: true`.
- Calibration does not alter routing weights, ranks, provider eligibility,
  quorum, or execution.
- The generated `deno task smoke` path remains fixture-only and does not call
  provider APIs.
- npm publication remains GitHub Actions OIDC Trusted Publishing from an
  immutable release tag.

## Install

```bash
npx --yes create-quorum-router@0.1.9 my-quorum-router-demo
cd my-quorum-router-demo
deno task check
deno task smoke
deno task calibration:demo
```

Source installer dry-run:

```bash
curl -fsSL https://raw.githubusercontent.com/sakamoto-sann/quorum-router/v0.1.9/install.sh | sh -s -- --dry-run
```
