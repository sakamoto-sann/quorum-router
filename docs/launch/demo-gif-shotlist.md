# Demo GIF shot list — Fusion Router v0.1 Public RC

> Screen recording plan only. Do not create a video/GIF unless explicitly
> requested.

## Terminal setup

- Recommended size: 100 columns x 32 rows.
- Theme: high contrast dark background, readable monospace font.
- Font size: large enough for mobile preview.
- Hide unrelated shell prompt decorations if possible.
- Record the two mode demos as two separate GIF files.

## GIF 1 — Best Route Game

### Commands to type

```bash
cd examples/best-route-game
deno task demo
```

### Pacing

1. Pause on `Mode: best_route`.
2. Pause on the route list.
3. Pause on the score table.
4. Pause on `Selected route: structured_direct`.
5. Final frame should show `Final answer: Door C` and the trace path.

### Final frame text

```text
Fusion Router v0.1 Public RC — Best Route mode chooses the best answer path
```

### Must not appear

- Commander
- Solver
- Reviewer
- Red Team
- Closeout

## GIF 2 — Agent Chat Game

### Commands to type

```bash
cd examples/agent-chat-game
deno task demo
```

### Pacing

1. Pause on `Mode: agent_chat`.
2. Pause on `Status: experimental explicit opt-in`.
3. Let the role turns appear in order.
4. Pause on Reviewer correcting Door B.
5. Pause on Red Team checking Door C.
6. Final frame should show Closeout and `Final: Door C`.

### Final frame text

```text
Fusion Router v0.1 Public RC — experimental Agent Chat mode, explicit opt-in
```

### Must not appear

- Best Route score table
- Do not include any claim that this is a production autonomous runtime

## Caption options

1. “GIF 1 shows Best Route mode choosing the best answer path.”
2. “GIF 2 shows experimental Agent Chat mode solving a puzzle through explicit
   multi-role conversation.”
3. “Two separate modes, two separate demos: production-ready best-answer routing
   vs experimental opt-in role conversation.”
4. “Both demos are deterministic fixtures: no external model/API call and no
   credentials required.”

## Alt text bundle

- **Best Route Game:** Terminal demo showing `Mode: best_route`, a Three Doors
  puzzle, direct route scoring, selected route `structured_direct`, final answer
  Door C, and displayed trace path
  `../../out/examples/best-route-game-trace.json`.
- **Agent Chat Game:** Terminal demo showing `Mode: agent_chat`, status
  `experimental explicit opt-in`, role turns for Commander, Solver, Reviewer,
  Red Team, and Closeout, final answer Door C, and displayed trace path
  `../../out/examples/agent-chat-game-trace.json`.

## Social preview text

Fusion Router v0.1 Public RC has two intentionally separate demos:

```text
GIF 1: Best Route mode choosing the best answer path.
GIF 2: experimental Agent Chat mode solving a puzzle through explicit roles.
```

Best Route is the production-ready best-answer routing path. `agent_chat` is
experimental explicit opt-in only. Source-Available Non-Commercial; not open
source.
