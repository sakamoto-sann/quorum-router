# Two-GIF demo plan — Fusion Router v0.1 Public RC

> Launch asset plan only. Do not publish, record, or post media without explicit
> approval. Fusion Router is Source-Available Non-Commercial, not open source.

## Why there are two GIFs

The previous single-demo framing made two different surfaces look like one mode.
That is misleading for external launch because **Best Route mode** and **Agent
Chat Game mode** prove different things and carry different runtime claims.

This plan separates them into two standalone terminal GIFs:

| GIF   | Mode         | What it proves                                                                       | What it must not imply                                        |
| ----- | ------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| GIF 1 | `best_route` | Production-ready direct/best-answer route comparison selects the best answer path.   | No role conversation, no `agent_chat`, no autonomous runtime. |
| GIF 2 | `agent_chat` | Experimental explicit opt-in multi-role conversation can solve a small game fixture. | Not Best Route mode; no production autonomous runtime.        |

## GIF 1 — Best Route mode

![Best Route mode demo](../assets/launch/fusion-router-best-route-game.gif)

**Command:**

```bash
cd examples/best-route-game
deno task demo
```

**Core proof:** Fusion Router compares deterministic direct routes for a small
Three Doors puzzle, scores the candidates, selects `structured_direct`, and
returns `Door C`.

**External wording:**

> GIF 1 shows Best Route mode choosing the best answer path.

**Boundary:** This GIF must not show Commander, Solver, Reviewer, Red Team, or
Closeout. It is a route-comparison / best-answer path selection demo only.

## GIF 2 — Agent Chat Game mode

![Agent Chat mode demo](../assets/launch/fusion-router-agent-chat-game.gif)

**Command:**

```bash
cd examples/agent-chat-game
deno task demo
```

**Core proof:** Fusion Router can show an experimental explicit opt-in
`agent_chat` fixture where Commander, Solver, Reviewer, Red Team, and Closeout
solve a small Three Doors puzzle by correcting a tempting wrong answer.

**External wording:**

> GIF 2 shows experimental Agent Chat mode solving a puzzle through explicit
> multi-role conversation.

**Boundary:** This GIF must not show a route score table or imply Best Route
always invokes `agent_chat`.

## How to avoid confusing them on Product Hunt/X

Use the two captions together:

1. “GIF 1 shows Best Route mode choosing the best answer path.”
2. “GIF 2 shows experimental Agent Chat mode solving a puzzle through explicit
   multi-role conversation.”

Then add the boundary sentence:

> These are intentionally separate demos: Best Route is the production-ready
> best-answer routing path; `agent_chat` is experimental explicit opt-in only.

## Shared fixture guarantees

Both demos are deterministic fixtures:

- no external model/API call is made;
- no credentials or secrets are required;
- no live Supabase Agent Bus runtime writes are made;
- no service-role runtime exists;
- no npm publishing, version bump, dist-tag mutation, or tag/release mutation is
  part of the demo flow.
