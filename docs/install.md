# Install QuorumRouter

External launch label: **QuorumRouter v0.1 public release**.

QuorumRouter is **MIT-licensed open source**. Commercial and production use are
permitted under the MIT License.

## Security boundaries

- `direct` is the production-ready best-answer routing path.
- Conversation-only `agent_chat` is explicit opt-in.
- Production autonomous repository execution is not installed or enabled by this
  helper; it requires a separately configured SafeLoop authority, signed policy,
  distinct approval, and confined action runner.
- No service-role runtime is configured.
- No live Supabase Agent Bus runtime writes are configured.
- No Supabase Realtime subscriber is installed.
- Generated projects include an optional user-owned Supabase audit migration,
  but audit remains disabled until the user explicitly configures it.
- The install helper does not ask for credentials, write secrets, enable process
  adapters, or configure live runtime services.

## Git clone quickstart

```bash
git clone https://github.com/sakamoto-sann/quorum-router.git
cd quorum-router
deno task smoke:v0.1
```

## Scaffold a project with npx

```bash
npx --yes create-quorum-router@latest my-quorum-router-demo
cd my-quorum-router-demo
deno task smoke
```

npm package target: `create-quorum-router@0.1.19`; npm dist-tag target:
`latest -> 0.1.19`. For a fixed package version after the release is published:

```bash
npx --yes create-quorum-router@0.1.19 my-quorum-router-demo
cd my-quorum-router-demo
deno task smoke
deno task calibration:hierarchy-demo
```

The scaffold does not fetch remote code during creation and does not install
dependencies automatically. `0.1.19` fixes exact-zero ensemble uplift reporting
and sentence-period handling for GitHub repository context URLs without changing
routing authority, quorum, synthesis, or execution. `0.1.18` added
measurement-only ensemble quality observability, `0.1.17` hardened guarded
calibration schema validation, `0.1.16` added the opt-in child-versus-parent
Brier drift guard, and `0.1.15` added the offline hierarchy walkthrough. The
underlying advisory hierarchical API shipped in `0.1.13`, and flat task
calibration remains available separately. The generated `deno task smoke` path
is offline/fixture-only and does not call a provider API or
`raw.githubusercontent.com`.

## Install helper dry run

For the latest source-tracking helper, inspect the install plan first:

```bash
curl -fsSL https://raw.githubusercontent.com/sakamoto-sann/quorum-router/main/install.sh | sh -s -- --dry-run --ref main
```

## Install helper actual install

```bash
curl -fsSL https://raw.githubusercontent.com/sakamoto-sann/quorum-router/main/install.sh | sh -s -- --prefix "$HOME/.local" --ref main
```

The helper clones the selected ref into `${PREFIX}/share/quorum-router`, writes
`${PREFIX}/bin/quorum-router`, and creates `${PREFIX}/bin/quorum` as a shorter
alias.

Wrapper commands:

```bash
quorum-router doctor
quorum-router models list
quorum-router models add codex gpt-5.4-mini
quorum-router models probe codex gpt-5.4-mini
quorum-router smoke
quorum-router test
quorum-router version
quorum-router update --check
quorum-router update
```

The installer also creates the shorter `quorum` alias, so terminal updates can
be run as:

```bash
quorum update --check
quorum update
```

An install made with `--ref main` tracks `origin/main` and updates only by a
clean-worktree fast-forward. A release-tag install checks out the latest fetched
`v*` release tag. Updates refuse dirty worktrees, unexpected branches, and
non-fast-forward history.

The helper fails clearly if the requested ref is unavailable. For local
source-tree evaluation only, pass an explicit ref:

```bash
sh install.sh --dry-run --ref main
```

Use a version tag instead of `--ref main` when you want release-channel rather
than source-channel updates.

## Uninstall

```bash
rm -rf "$HOME/.local/share/quorum-router"
rm -f "$HOME/.local/bin/quorum-router"
rm -f "$HOME/.local/bin/quorum"
```

Adjust the paths if you installed with a different `--prefix`.

## Troubleshooting

- `missing required tool: git`: install Git and retry.
- `missing required tool: deno`: install Deno and retry.
- Clone or checkout errors for `v0.1.19`: verify network access and the ref
  spelling.
- `quorum-router: command not found`: add `${PREFIX}/bin` to your shell `PATH`.
- Scaffold `deno task smoke` is offline/fixture-only. If it fails, check local
  Deno install / permissions first; do not debug `raw.githubusercontent.com` for
  smoke. Network is only required for install-helper clone and optional external
  provider dogfood (`RUN_EXTERNAL_MODEL_DOGFOOD=1`).

For optional BYO audit setup, follow
[`supabase-audit-setup.md`](./supabase-audit-setup.md). The generated project
uses only its project URL, publishable/anon key, and active Supabase Auth
session JWT at runtime. Do not place service-role/admin credentials in the
runtime.
