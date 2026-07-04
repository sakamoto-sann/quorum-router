# Best Route Game GIF — Fusion Router v0.1 Public RC

> GIF 1. This is the production-ready best-answer routing path demo. Do not
> describe it as Agent Chat or autonomous runtime.

![Best Route mode demo](../assets/launch/fusion-router-best-route-game.gif)

## Terminal recording commands

Recommended terminal: 100 columns x 32 rows, high-contrast dark theme, large
monospace font.

```bash
cd examples/best-route-game
deno task demo
```

Optional trace readback after the final frame:

```bash
cat ../../out/examples/best-route-game-summary.md
```

## Expected output

See
[`../../examples/best-route-game/expected-output.md`](../../examples/best-route-game/expected-output.md).

Required visible markers:

```text
Fusion Router v0.1 Public RC
Mode: best_route
Demo: Best Route Game
Selected route:
  structured_direct
Final answer:
  Door C
Trace:
  ../../out/examples/best-route-game-trace.json
```

The output must **not** contain Commander, Solver, Reviewer, Red Team, or
Closeout role turns.

## Caption options

1. “GIF 1: Best Route mode chooses the best answer path.”
2. “Fusion Router compares direct routes, scores consistency/risk, and selects
   `structured_direct` → Door C.”
3. “Production-ready best-answer routing path. No role conversation, no external
   model/API call.”
4. “Best Route mode is separate from experimental `agent_chat`.”

## Alt text

Terminal recording of Fusion Router v0.1 Public RC running
`cd examples/best-route-game && deno task demo`. The output shows
`Mode: best_route`, a Three Doors puzzle, three direct routes (`fast_direct`,
`structured_direct`, `guarded_direct`), a score table, selected route
`structured_direct`, final answer `Door C`, and displayed trace path
`../../out/examples/best-route-game-trace.json`.

## Short Product Hunt caption

GIF 1 shows Best Route mode choosing the best answer path: deterministic direct
routes are scored, `structured_direct` wins, and the final answer is Door C.

## Short X caption

GIF 1: Best Route mode. Fusion Router compares direct answer routes, selects
`structured_direct`, and returns Door C. Separate from experimental
`agent_chat`.

## Claims to avoid

- Do not call Fusion Router open source.
- Do not claim production autonomous runtime.
- Do not imply Best Route always invokes `agent_chat`.
- Do not claim live Supabase Agent Bus runtime writes.
- Do not claim service-role runtime.
- Do not imply external model/API calls are required for this demo.
