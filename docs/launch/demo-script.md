# Terminal demo script — Fusion Router v0.1 Public RC

> Script for recorded or live terminal demos. Do not claim open source
> licensing. Do not claim production autonomous runtime. Do not claim live
> Supabase Agent Bus runtime writes. Do not claim service-role runtime.

## Two separate GIFs

Use two separate recordings so external viewers do not confuse Best Route mode
with experimental Agent Chat mode.

| GIF   | Command                                         | Message                                                                                |
| ----- | ----------------------------------------------- | -------------------------------------------------------------------------------------- |
| GIF 1 | `cd examples/best-route-game && deno task demo` | Best Route mode chooses the best answer path.                                          |
| GIF 2 | `cd examples/agent-chat-game && deno task demo` | Experimental Agent Chat mode solves a puzzle through explicit multi-role conversation. |

## GIF 1 script — Best Route Game

```bash
cd examples/best-route-game
deno task demo
```

Narration:

- “This is Fusion Router v0.1 Public RC.”
- “Mode is `best_route`.”
- “The demo compares direct answer routes for the same Three Doors puzzle.”
- “The production-ready best-answer path selects `structured_direct`.”
- “Final answer is Door C.”
- “No external model/API call was made; this is a deterministic fixture.”

Do **not** mention Commander, Solver, Reviewer, Red Team, or Closeout in this
GIF.

## GIF 2 script — Agent Chat Game

```bash
cd examples/agent-chat-game
deno task demo
```

Narration:

- “This is the separate `agent_chat` demo.”
- “Status is experimental explicit opt-in.”
- “Commander, Solver, Reviewer, Red Team, and Closeout solve the puzzle through
  role turns.”
- “Reviewer and Red Team correct the tempting Door B answer.”
- “Final answer is Door C.”
- “No external model/API call was made; this is a deterministic fixture.”

Do **not** describe this GIF as Best Route mode.

## Existing NPX quickstart clip

The NPX quickstart remains useful as an install/scaffold clip, but it should not
replace the two mode-specific GIFs.

```bash
npx --yes create-fusion-router@latest my-fusion-router-demo
cd my-fusion-router-demo
deno task smoke
```

Use it only for “install to smoke” messaging. Use the two new GIFs for mode
positioning.

## What to say in launch copy

- “GIF 1 shows Best Route mode choosing the best answer path.”
- “GIF 2 shows experimental Agent Chat mode solving a puzzle through explicit
  multi-role conversation.”
- “The two demos are intentionally separate.”
- “Best Route is the production-ready best-answer routing path.”
- “`agent_chat` is experimental explicit opt-in only.”
- “Fusion Router is Source-Available Non-Commercial, not open source.”

## What not to claim

- Do not claim Fusion Router is open source.
- Do not claim this is a production autonomous runtime.
- Do not claim `agent_chat` is production-ready.
- Do not imply Best Route always invokes `agent_chat`.
- Do not claim live Supabase Agent Bus runtime writes exist.
- Do not claim service-role runtime exists.
- Do not claim this is a full multi-agent production system.
- Do not imply external model/API calls, secrets, or credentials are required
  for these demos.
