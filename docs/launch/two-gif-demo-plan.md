# Two-GIF demo plan — QuorumRouter v0.1 public preview

> Launch asset plan only. Do not publish, record, or post media without explicit
> approval. QuorumRouter is Source-Available Non-Commercial, not open source.

## Why there are two GIFs

The demos use the same simple shogi setup with fixture agents named `Grok` and
`GLM`, but they prove different surfaces. The names are deterministic labels for
recording; no external Grok/GLM model/API call is made.

| GIF   | Mode         | What it proves                                                                  | What it must not imply                                                            |
| ----- | ------------ | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| GIF 1 | `best_route` | Production-ready direct/best-answer route comparison chooses a next shogi move. | No role conversation, no `agent_chat`, no autonomous runtime, no live model call. |
| GIF 2 | `agent_chat` | Conversation fixture showing a Grok vs GLM shogi excerpt.                       | Not the production SafeLoop execution demo; no live model call.                   |

## GIF 1 — Best Route mode

![Best Route mode demo](../assets/launch/fusion-router-best-route-game.gif)

**Command:**

```bash
cd examples/best-route-game
deno task demo
```

**Core proof:** QuorumRouter compares deterministic candidate lines for a small
shogi opening excerpt, selects `balanced_development`, chooses `Grok ▲S-68`, and
fades out before the full match.

**External wording:**

> GIF 1 shows Best Route mode choosing a shogi next move.

**Boundary:** This GIF must not show `Mode: agent_chat` or imply real Grok/GLM
API calls.

## GIF 2 — Agent Chat mode

![Agent Chat mode demo](../assets/launch/fusion-router-agent-chat-game.gif)

**Command:**

```bash
cd examples/agent-chat-game
deno task demo
```

**Core proof:** QuorumRouter can show an experimental explicit opt-in
`agent_chat` fixture where Grok and GLM alternate a few shogi opening moves,
then fade out before the full match.

**External wording:**

> GIF 2 shows experimental Agent Chat mode with a short Grok vs GLM shogi
> excerpt.

**Boundary:** This GIF must not show a route score table, imply Best Route
always invokes `agent_chat`, or imply real Grok/GLM model/API calls.

## How to avoid confusing them on Product Hunt/X

Use the two captions together:

1. “GIF 1 shows Best Route mode choosing a shogi next move.”
2. “GIF 2 shows experimental Agent Chat mode with a short Grok vs GLM shogi
   excerpt.”

Then add the boundary sentence:

> These are intentionally separate demos: Best Route is the production-ready
> best-answer routing path; `agent_chat` is experimental explicit opt-in only.

## Shared fixture guarantees

Both demos are deterministic fixtures:

- no external Grok/GLM model/API call is made;
- no credentials or secrets are required;
- no live Supabase Agent Bus runtime writes are made;
- no service-role runtime exists;
- no npm publishing, version bump, dist-tag mutation, or tag/release mutation is
  part of the demo flow.
