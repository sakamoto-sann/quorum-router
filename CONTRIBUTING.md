# Contributing to QuorumRouter

QuorumRouter accepts focused, reviewable changes that preserve fail-closed
routing and explicit execution authority.

## Required workflow

Use this sequence for every non-trivial change:

1. **Issue** — describe the problem, evidence, scope, non-goals, and acceptance
   criteria.
2. **Branch** — create a focused branch from the latest `main`; do not develop
   directly on `main`.
3. **Pull request** — link the issue with `Closes #N`, explain safety
   boundaries, and list commands actually run.
4. **Review** — address every valid finding on the exact PR head. Unresolved
   review threads are merge blockers.
5. **Merge and readback** — merge only after required checks pass, then verify
   the merge commit and rerun the relevant checks on `main`.

Small typo-only corrections may start at step 2 when an Issue would add no
useful context. Security reports should follow GitHub's private
vulnerability-reporting path rather than a public Issue.

These are project policy requirements, not all repository-local CI checks. For
non-administrator changes, GitHub branch protection enforces pull-request-only
changes and resolved review conversations on `main`; CI enforces repository
checks. Administrators can bypass the current protection settings, and GitHub
does not currently require an approving review. Issue linkage, exact-head review
evidence, administrator compliance, and post-merge readback therefore remain
reviewer/operator responsibilities and must be recorded in the PR.

## Branch and commit discipline

- Start from a clean, current `origin/main`.
- Prefer `<type>/<short-scope>` names such as `docs/evolution-path` or
  `fix/budget-state-lock`.
- Keep one concern per branch and PR. Separate documentation, runtime authority,
  and release changes when they can be reviewed independently.
- Make commits cohesive and use imperative subjects.
- Rebase before first push when `main` has advanced. After review starts, avoid
  rewriting history unless a focused amend is materially clearer.
- If a reviewed branch must be rewritten, use an exact `--force-with-lease`
  against the previously read remote object ID. Never use an unguarded force
  push.

## Pull request contract

A PR must include:

- linked Issue and explicit non-goals;
- user-visible behavior and trust-boundary changes;
- tests/checks actually executed, without invented results;
- migration or rollback notes when state or compatibility changes;
- no credentials, raw private prompts, or sensitive production artifacts.

Draft PRs are welcome for early design review, but they are not merge
candidates.

## Verification

Run the narrowest focused tests first, then the repository gates before
requesting merge:

```bash
deno task lock:check
deno task fmt
deno task lint
deno task check
deno task test
deno task smoke:v0.1
```

Live-provider or external dogfood is explicit opt-in and must not be presented
as a deterministic CI result. Benchmark publications must retain methodology,
provenance, sample size, and limitations. Content-minimized summaries must not
contain raw prompts, answers, organization identifiers, credentials, task names,
or per-case score/token fingerprints.

Before push, scan the exact outgoing commit range with the repository's
secret-scanning workflow. Do not suppress avoidable findings with broad
allowlists.

## Safety invariants

Changes must preserve these defaults unless a separately reviewed authority
proposal says otherwise:

- Best Route/direct remains the production routing path.
- Experimental modes require explicit enablement and fail closed.
- Advisory calibration and shadow evaluation do not gain routing, approval,
  synthesis, or execution authority.
- QuorumRouter does not self-approve repository or shell mutations.
- SafeLoop is the injected execution authority; only a digest-bound verified
  receipt is accepted.
- Provider failures remain visible. No silent fallback may convert a failed
  provider into a successful result.

## Review expectations

Reviewers should check:

- correctness and regression coverage;
- malformed-input, timeout, cancellation, and failure behavior;
- authority or privilege expansion;
- secret and sensitive-data exposure;
- compatibility and migration risk;
- whether documentation claims match executed code and evidence.

Approval of prose is not approval of a runtime authority change. Code, tests,
docs, workflows, and generated evidence must agree.

## Supply-chain changes

Dependency, workflow-action, release, and SBOM changes require their own
reviewable evidence. Pin third-party GitHub Actions to immutable commits, keep
the lockfile frozen in CI, and do not publish guessed package metadata. See
[docs/supply-chain.md](docs/supply-chain.md).
