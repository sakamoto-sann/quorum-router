# Launch readiness report — QuorumRouter

Verified against GitHub `main` and the public npm registry on 2026-07-12.

## Current identity

- Repository: https://github.com/sakamoto-sann/quorum-router
- Release source: protected `main` through reviewed PRs
- License: MIT; OSI-approved open source
- Latest GitHub tag: `v0.1.5`
- Registry package: `create-quorum-router@0.1.5` (`latest -> 0.1.5`)

The public quickstart uses the npm registry package:

```bash
npx --yes create-quorum-router@latest my-quorum-router
cd my-quorum-router
deno task check
deno task smoke
```

Fresh registry-backed scaffold verification: **PASS**. The exact command
`npx --yes create-quorum-router generated` created a project whose
`deno task check` and `deno task smoke` both passed.

## Launch media

The primary media consists of two separate videos because the interaction
contracts are different.

| Video      | Contract                                                                            | MP4                                               |
| ---------- | ----------------------------------------------------------------------------------- | ------------------------------------------------- |
| Best Route | Independent Grok/Claude/Qwen candidates → comparison → selection → synthesis        | `docs/assets/launch/quorum-router-best-route.mp4` |
| Agent Chat | Grok ↔ GLM shared-context replies → disagreement → revision → challenge → consensus | `docs/assets/launch/quorum-router-agent-chat.mp4` |

Verified public assets:

- Best Route MP4: 716,943 bytes
- Agent Chat MP4: 1,421,277 bytes
- README embeds separate optimized GIFs and links both MP4 files

The recordings are deterministic CLI visualizations and must not be described as
live external model/API traffic. The separately verified source-backed CLI does
run live wrapper-backed dialogue: OpenAI/codex-cli ↔ Cognition/devin-cli
completed four visible turns with bound reply lineage, valid schema, and
redaction checks.

## Runtime boundaries

- Best Route keeps candidate contexts isolated before router synthesis.
- Conversation-only Agent Chat is explicit opt-in and preserves model identity
  and reply lineage across bounded turns.
- SafeLoop-backed local repository execution requires signed policy and distinct
  exact-digest approval.
- QuorumRouter cannot sign, self-approve, or bypass SafeLoop.
- GitHub, database, external API, release, policy, and credential mutations
  remain blocked from autonomous model execution.
- No live Supabase Agent Bus runtime writes and no service-role runtime.

## Release metadata readback

With explicit operator approval, release titles and notes for `v0.1.0` through
`v0.1.4` were updated to QuorumRouter. Readback confirms every release is
published, non-draft, non-prerelease, and contains no stale pre-launch
positioning.

Historical release notes distinguish the legacy package from QuorumRouter.

Registry readback and clean-room NPX smoke succeeded for `0.1.5`.

## Final launch gates

- [x] GitHub repository name is QuorumRouter.
- [x] Source-backed quickstart creates a fresh scaffold.
- [x] Generated `deno task check` passes.
- [x] Generated `deno task smoke` passes.
- [x] Best Route and Agent Chat videos are separate.
- [x] Agent Chat visibly shows cross-model reply lineage.
- [x] Launch media links resolve from `main`.
- [x] License and SafeLoop authority boundaries are stated.
- [x] Rename/review GitHub release metadata `v0.1.0`–`v0.1.4` with explicit
      approval.
- [ ] Preview the final Product Hunt listing with both videos attached.
- [ ] Obtain explicit approval immediately before Product Hunt publication.
- [ ] Preview the final X thread and attachment order.
- [ ] Obtain explicit approval immediately before X posting.
