# Best Route Shogi demo

This demo is **GIF 1** for Fusion Router v0.1 Public RC.

It shows **Best Route mode** as a production-ready best-answer routing path:
Fusion Router compares deterministic candidate lines for a small shogi opening
excerpt, selects a next move, and fades out before the full match.

The fixture agents are named `Grok` and `GLM`, but no external Grok/GLM
model/API call is made.

It is intentionally **not** a conversation demo.

## Run

```bash
cd examples/best-route-game
deno task demo
```

## What it proves

- `Mode: best_route` is visually explicit.
- Fixture agents are shown as `Grok vs GLM`.
- Multiple direct candidate lines are compared for the same shogi excerpt.
- `balanced_development` wins because it has the best clarity/safety/tempo
  score.
- The next move is `Grok ▲S-68`.
- The clip fades out before showing the full match.
- No external model/API call is made.
- No credentials or secrets are required.

## What it does not show

- No multi-role conversation.
- No `agent_chat` runtime.
- No live Grok/GLM API call.
- No production autonomous runtime claim.
- No live Supabase Agent Bus runtime writes.
- No service-role runtime.

## Generated artifacts

Running the demo writes deterministic trace artifacts:

- `out/examples/best-route-game-trace.json`
- `out/examples/best-route-game-summary.md`

The trace JSON records `mode: "best_route"`, the shogi fixture, route
candidates, scores, selected route, selected move, fadeout note, and the
deterministic/no external-call boundary.
