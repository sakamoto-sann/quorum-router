# Expected output — Agent Chat Shogi Excerpt

```text
QuorumRouter v0.1 public preview
Mode: agent_chat
Status: experimental explicit opt-in
Demo: Mini Shogi Opening Excerpt
Fixture agents: Grok vs GLM

Board:
      5  4  3  2  1
  a   .  .  k  .  .
  b   .  b  .  r  .
  c   p  p  p  p  p
  d   P  P  P  P  P
  e   .  R  .  B  K

Partial match:
1. Grok:
  ▲P-76 — opens the bishop diagonal.

1... GLM:
  △P-34 — mirrors the center fight.

2. Grok:
  ▲P-26 — prepares rook-side pressure.

2... GLM:
  △P-84 — challenges the rook file.

3. Grok:
  ▲S-68 — develops instead of over-pushing.

3... GLM:
  △P-85 — the counterattack starts; fade out before the full match.

Fadeout:
  Match continues after this opening excerpt...

Trace:
  ../../out/examples/agent-chat-game-trace.json

No external Grok/GLM model/API call was made. This is a deterministic demo fixture.
Summary: ../../out/examples/agent-chat-game-summary.md
```

Validation notes:

- Output contains `Mode: agent_chat`.
- Output contains `experimental explicit opt-in`.
- Output contains `Fixture agents: Grok vs GLM`.
- Output contains a partial shogi match, not a complete game.
- Output contains `1. Grok:`, `1... GLM:`, and `3... GLM:`.
- Output contains `Fadeout:` and `Match continues after this opening excerpt`.
- Output does **not** contain a best-route scoring section.
