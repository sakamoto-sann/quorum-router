# Supply-chain controls

QuorumRouter uses staged supply-chain controls that match what GitHub and Deno
can verify today. The project does not claim that a generated SBOM proves
runtime behavior or contains every transitive Deno dependency.

## Enforced controls

| Control                      | Enforcement                                | Scope                                                                     |
| ---------------------------- | ------------------------------------------ | ------------------------------------------------------------------------- |
| Frozen Deno lockfiles        | Root and local-dogfood frozen checks in CI | Rejects dependency resolution that differs from either committed lockfile |
| Immutable Actions references | Full commit SHAs in `.github/workflows/`   | Reduces tag-retargeting risk                                              |
| Dependency review            | `.github/workflows/dependency-review.yml`  | Blocks graph-recognized high-or-critical vulnerable additions             |
| Secret scanning              | Repository hooks plus CI/history checks    | Prevents credential-shaped material from being shipped                    |
| Release isolation            | `.github/workflows/publish.yml`            | Keeps publish permissions in bounded jobs                                 |
| Manual SPDX export           | `.github/workflows/sbom.yml`               | Exports GitHub's dependency graph as a downloadable workflow artifact     |

## Deno limitation

GitHub lists Deno as a supported dependency-graph ecosystem and recognizes
`deno.lock`, `deno.json`, and `deno.jsonc`. As of this control's introduction,
GitHub's supported-ecosystems table marks **static transitive dependencies for
Deno as not supported**.

Consequences:

- dependency review is useful only for dependency changes GitHub's graph
  actually recognizes;
- the exported SPDX document is an inventory of GitHub's dependency graph, not
  an independently complete Deno closure;
- operators must inspect package coverage after graph indexing; a root-only
  snapshot proves no third-party dependency coverage;
- a clean dependency review or SBOM is not evidence that provider output,
  routing policy, or SafeLoop execution is safe.

The root Deno graph and `examples/local-model-dogfood` use separate committed
lockfiles. The root `lock:check` runs both frozen validations so the nested npm
`zod` import cannot bypass reproducibility checks.

Primary references:

- [Dependency graph supported package ecosystems](https://docs.github.com/en/code-security/reference/supply-chain-security/dependency-graph-supported-package-ecosystems)
- [Exporting dependencies as an SBOM](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/establish-provenance-and-integrity/export-dependencies-as-sbom)
- [SBOM REST endpoint](https://docs.github.com/en/rest/dependency-graph/sboms#get-a-repository-sbom)

## Dependency-review policy

The pull-request workflow uses GitHub's official dependency review action,
pinned to an immutable commit. It fails on additions with severity `high` or
`critical`. Medium and low findings remain visible for review but do not block
by default.

This is additive to normal code review. A dependency change still needs:

1. an Issue explaining why the dependency is required;
2. a minimal lockfile diff;
3. license and maintainer review where applicable;
4. normal tests and secret scans;
5. an explicit reviewer decision on any non-blocking advisory.

## Exporting an SBOM

Run **Actions → Export SBOM → Run workflow** from the repository's default
branch. The workflow rejects tag and non-default-branch dispatches because
GitHub's repository-level SBOM endpoint accepts no ref parameter. It then:

1. requests the repository SBOM from GitHub's dependency-graph REST endpoint;
2. bounds and validates the response wrapper;
3. validates core SPDX 2.x document fields and repository binding;
4. extracts a standalone `quorum-router.spdx.json`;
5. adds a SHA-256 checksum;
6. uploads both files as a 30-day workflow artifact.

The workflow does not commit generated SBOMs because checked-in snapshots become
stale immediately. The artifact describes GitHub's repository-level dependency
graph at export time; it is **not bound to the workflow SHA or a release tag**
and must not be presented as a release-specific SBOM. Release-to-SBOM digest
binding remains a future control.

## Next maturity steps

Not yet implemented:

- attest the SBOM and release artifact with GitHub artifact attestations;
- submit a Deno-specific complete transitive dependency snapshot if a
  maintained, reviewable producer becomes available;
- add a license allow/deny policy after auditing current dependency metadata;
- add release-to-SBOM digest binding and provenance verification.

These are future controls, not current guarantees.
