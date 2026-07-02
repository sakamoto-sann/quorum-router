# v0.1 Release Checklist

Use this checklist for the v0.1 Safe Direct Router release PR and merge
closeout.

## Local verification

- [ ] `deno task fmt`
- [ ] `deno task lock:check`
- [ ] `deno task check`
- [ ] `deno task lint`
- [ ] `deno task test`
- [ ] `deno task doctor`
- [ ] `deno task smoke:v0.1`
- [ ] `gitleaks git --log-opts "$(git merge-base origin/main HEAD)..HEAD" --redact --no-banner`

## Expected local results

- [ ] Tests pass with the expected count for the branch.
- [ ] `smoke:v0.1` passes.
- [ ] Doctor reports `ok: true`.
- [ ] `supabase_audit_config`: `not configured`, severity `info`.
- [ ] `cli_zcode`: `not found`, severity `warn`.
- [ ] Gitleaks reports no leaks found.

## PR review and GitHub state

- [ ] No unresolved review threads.
- [ ] GitHub checks pass if present.
- [ ] If GitHub checks are not reported, state that exactly; do not claim pass.
- [ ] PR is mergeable / clean before merge.

## Merge closeout

- [ ] Squash merge the PR.
- [ ] Pull `main` with `git pull --ff-only origin main`.
- [ ] Re-run release verification on `main`.
- [ ] Confirm local `main` HEAD equals `origin/main` HEAD.
- [ ] Confirm worktree clean.
- [ ] Confirm feature branch deleted after merge.
