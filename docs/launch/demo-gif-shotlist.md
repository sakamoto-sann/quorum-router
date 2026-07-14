# Demo GIF shot list — QuorumRouter

> Screen recording plan only. Do not post media without explicit launch
> approval.

## Terminal setup

- Recommended size: 100 columns x 32 rows.
- Theme: high contrast dark background, readable monospace font.
- Font size: large enough for mobile preview.
- Hide unrelated shell prompt decorations if possible.
- Record the two mode demos as two separate GIF files.
- The fixture agents are named `Grok` and `GLM`, but they are deterministic
  labels only; no external Grok/GLM model/API calls are made.

## GIF 1 — Best Route shogi excerpt

### Commands to type

```bash
cd examples/best-route-game
deno task demo
```

### Pacing

1. Pause on `Mode: best_route`.
2. Pause on `Fixture agents: Grok vs GLM` and the mini shogi board.
3. Pause on the opening excerpt.
4. Pause on the route score table.
5. Pause on `Selected route: balanced_development`.
6. Final frame should show `Next move: Grok ▲S-68`, `Fadeout preview`, and the
   trace path.

### Final frame text

```text
QuorumRouter — Best Route chooses a Grok vs GLM shogi line
```

### Must not appear

- `Mode: agent_chat`
- role-conversation framing
- Any claim that real Grok or GLM model/API calls are made
- Any claim that this is a production autonomous runtime

## GIF 2 — Agent Chat shogi excerpt

### Commands to type

```bash
cd examples/agent-chat-game
deno task demo
```

### Pacing

1. Pause on `Mode: agent_chat`.
2. Pause on `Status: explicit opt-in conversation mode`.
3. Pause on `Fixture agents: Grok vs GLM` and the mini shogi board.
4. Let Grok and GLM alternate the short opening excerpt.
5. Pause on `3... GLM` starting the counterattack.
6. Final frame should show
   `Fadeout: Match continues after this opening excerpt`.

### Final frame text

```text
QuorumRouter — experimental Agent Chat shogi excerpt, explicit opt-in
```

### Must not appear

- Best Route score table
- Any claim that real Grok or GLM model/API calls are made
- Any claim that this is a production autonomous runtime

## Caption options

1. “GIF 1 shows Best Route mode choosing a next move in a Grok vs GLM shogi
   excerpt.”
2. “GIF 2 shows experimental Agent Chat mode: Grok and GLM alternate a few shogi
   moves, then fade out.”
3. “Two separate modes, two separate demos: production-ready best-answer routing
   vs experimental opt-in conversation.”
4. “Both demos are deterministic fixtures: no external model/API call and no
   credentials required.”

## Alt text bundle

- **Best Route shogi:** Terminal demo showing `Mode: best_route`, fixture agents
  `Grok vs GLM`, a simple mini shogi board, opening moves, route scoring,
  selected route `balanced_development`, next move `Grok ▲S-68`, fadeout
  preview, and displayed trace path
  `../../out/examples/best-route-game-trace.json`.
- **Agent Chat shogi:** Terminal demo showing `Mode: agent_chat`, status
  `explicit opt-in conversation mode`, fixture agents `Grok vs GLM`, a partial
  shogi match, a fadeout line, and displayed trace path
  `../../out/examples/agent-chat-game-trace.json`.

## Social preview text

QuorumRouter has two intentionally separate demos:

```text
GIF 1: Best Route mode chooses a shogi next move.
GIF 2: experimental Agent Chat mode shows a Grok vs GLM shogi excerpt.
```

Best Route is the production-ready best-answer routing path. `agent_chat` is
explicit opt-in conversation mode only. MIT-licensed open source.
