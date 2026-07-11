# Launch readiness report — QuorumRouter

Verified against GitHub `main` and the public npm registry on 2026-07-11.

## Current identity

- Repository: https://github.com/sakamoto-sann/quorum-router
- `main`: `3f2349b5924d8dc805f404922a9593f3b59a17c2`
- License: MIT; OSI-approved open source
- Latest GitHub tag: `v0.1.4`
- Registry package `create-quorum-router`: **not published** (`npm view` returns
  `E404`)

The working public quickstart therefore uses the GitHub source installer, not an
npm registry claim:

```bash
npx --yes github:sakamoto-sann/quorum-router#main my-quorum-router
cd my-quorum-router
deno task check
deno task smoke
```

Fresh source-backed scaffold verification: **PASS**.

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
published, non-draft, non-prerelease, and contains no `Public RC`,
`public
preview`, `proof-of-concept`, or `PoC` wording.

The `v0.1.3` and `v0.1.4` notes distinguish the historical legacy package from
the current GitHub source-backed installer.

npm publication is not required for the working GitHub-source quickstart. Do not
claim that `create-quorum-router` exists on npm until registry readback
succeeds.

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
