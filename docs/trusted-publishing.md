# npm Trusted Publishing runbook

The npm package already exists:

- package: `create-quorum-router`
- first live package version: `create-quorum-router@0.1.5`
- current npm dist-tag: `latest -> 0.1.5`

The first manual publish is complete. The package is public at `0.1.5`. The
GitHub OIDC workflow completed all verification but returned `ENEEDAUTH` at the
publish step because the renamed package still needs its Trusted Publisher UI
binding. Configure the exact identity below before the next release. Do not
publish another version unless explicitly instructed.

## Policy

Next releases should use npm Trusted Publishing through GitHub Actions OIDC
instead of a long-lived npm token.

Do not use a long-lived npm token unless explicitly approved for a specific
release operation. Never commit npm tokens, passwords, OTPs, or temporary npmrc
files.

Do not publish a new package version without explicit instruction. Do not mutate
npm dist-tags without explicit instruction.

## Required npm UI configuration

Configure the trusted publisher in the npm package settings with this exact
identity:

- Provider: GitHub Actions
- Organization/user: `sakamoto-sann`
- Repository: `quorum-router`
- Workflow filename: `publish.yml`
- Environment: empty unless intentionally configured

The workflow filename is the basename only: `publish.yml`, not
`.github/workflows/publish.yml`.

## Workflow requirements

The GitHub Actions workflow should include:

```yaml
permissions:
  contents: read
  id-token: write
```

Required runtime setup:

- supported Node/npm version for npm Trusted Publishing and provenance
- `actions/setup-node` configured with
  `registry-url: "https://registry.npmjs.org"`
- package metadata verification before publish
- `npm pack --dry-run --json` tarball verification before publish
- repository verification before publish
- no committed npm token

Current workflow path:
[`.github/workflows/publish.yml`](../.github/workflows/publish.yml).

## Invocation discipline

Publishing must be an explicit release action:

- manual `workflow_dispatch` with an explicit release tag input, or
- a deliberate release tag push that matches the workflow tag condition

The workflow must not publish from ordinary `push` events to `main`.

Before invoking the workflow for a future version:

1. Confirm the target version is intentionally approved.
2. Confirm the corresponding Git tag exists and points at the intended release
   commit.
3. Confirm `packages/create-quorum-router/package.json` has the approved
   version.
4. Confirm `npm view create-quorum-router@<version>` does not already return a
   published package.
5. Confirm no npm token is committed or needed.
6. Run the local verification stack and package dry-run.

## Non-goals for this public preview closeout

This runbook covers the `0.1.5` Trusted Publishing path after explicit release
approval. Do not move tags, mutate dist-tags, or expand runtime behavior outside
that approved release flow.
