# Launch readiness report — QuorumRouter

Verified against GitHub `main` and the public npm registry on 2026-07-11.

## Current identity

- Repository: https://github.com/sakamoto-sann/quorum-router
- `main`: `3f2349b5924d8dc805f404922a9593f3b59a17c2`
- License: Source-Available Non-Commercial; not OSI open source
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
live external model/API traffic.

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

## Current blocker

The latest GitHub release exists at `v0.1.4`, but its title still says **“Fusion
Router v0.1.4 — Real Provider Dogfood & URL Context.”** Older release titles
also contain legacy `Fusion Router` / `Public RC` branding.

Changing published GitHub release metadata is an external write and requires
explicit operator approval. Do not describe the public launch as fully clean
until at least the latest `v0.1.4` release title and notes are reviewed and
renamed to QuorumRouter.

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
- [ ] Rename/review the latest GitHub release metadata with explicit approval.
- [ ] Preview the final Product Hunt listing with both videos attached.
- [ ] Obtain explicit approval immediately before Product Hunt publication.
- [ ] Preview the final X thread and attachment order.
- [ ] Obtain explicit approval immediately before X posting.
