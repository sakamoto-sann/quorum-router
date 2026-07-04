# Best Route Game demo

This demo is **GIF 1** for Fusion Router v0.1 Public RC.

It shows **Best Route mode** as a production-ready best-answer routing path:
Fusion Router compares deterministic direct answer routes for a small game,
scores the candidates, selects the best route, and prints the final answer.

It is intentionally **not** a conversation demo.

## Run

```bash
cd examples/best-route-game
deno task demo
```

## What it proves

- `Mode: best_route` is visually explicit.
- Multiple direct answer routes are compared for the same puzzle.
- `structured_direct` wins because it has the highest clue-consistency score
  with low risk.
- The final answer is `Door C`.
- No external model/API call is made.
- No credentials or secrets are required.

## What it does not show

- No multi-role conversation.
- No `agent_chat` runtime.
- No production autonomous runtime claim.
- No live Supabase Agent Bus runtime writes.
- No service-role runtime.

## Generated artifacts

Running the demo writes deterministic trace artifacts:

- `out/examples/best-route-game-trace.json`
- `out/examples/best-route-game-summary.md`

The trace JSON records `mode: "best_route"`, the game fixture, route candidates,
scores, selected route, final answer, reason, and the
deterministic/no-external-call boundary.
