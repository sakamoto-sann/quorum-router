# Best Route Shogi GIF — Fusion Router v0.1 Public RC

> GIF 1. This is the production-ready best-answer routing path demo. Do not
> describe it as Agent Chat, a live Grok/GLM model call, or autonomous runtime.

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
Demo: Mini Shogi Opening Excerpt
Fixture agents: Grok vs GLM
Routes evaluated:
Selected route:
  balanced_development
Next move:
  Grok ▲S-68
Fadeout preview:
  Match continues after this opening excerpt...
Trace:
  ../../out/examples/best-route-game-trace.json
```

The output must **not** contain `Mode: agent_chat` or role-conversation framing.

## Caption options

1. “GIF 1: Best Route mode chooses the next move in a Grok vs GLM shogi
   excerpt.”
2. “Fusion Router compares candidate shogi lines, selects
   `balanced_development`, and fades out before the full match.”
3. “Production-ready best-answer routing path. No role conversation, no external
   Grok/GLM model/API call.”
4. “Best Route mode is separate from experimental `agent_chat`.”

## Alt text

Terminal recording of Fusion Router v0.1 Public RC running
`cd examples/best-route-game && deno task demo`. The output shows
`Mode: best_route`, fixture agents `Grok vs GLM`, a simple mini shogi board,
opening moves, route scores, selected route `balanced_development`, next move
`Grok ▲S-68`, a fadeout preview saying the match continues, and displayed trace
path `../../out/examples/best-route-game-trace.json`.

## Short Product Hunt caption

GIF 1 shows Best Route mode choosing a shogi next move: deterministic Grok vs
GLM fixture lines are scored, `balanced_development` wins, and the demo fades
out before the full match.

## Short X caption

GIF 1: Best Route mode. Fusion Router compares Grok vs GLM shogi lines, selects
`balanced_development`, and fades out before the full match. Separate from
experimental `agent_chat`.

## Claims to avoid

- Do not call Fusion Router open source.
- Do not claim real Grok or GLM external model/API calls are made.
- Do not claim production autonomous runtime.
- Do not imply Best Route always invokes `agent_chat`.
- Do not claim live Supabase Agent Bus runtime writes.
- Do not claim service-role runtime.
