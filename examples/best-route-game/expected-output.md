# Expected output — Best Route Shogi Excerpt

```text
QuorumRouter v0.1 public preview
Mode: best_route
Demo: Mini Shogi Opening Excerpt
Fixture agents: Grok vs GLM

Board:
      5  4  3  2  1
  a   .  .  k  .  .
  b   .  b  .  r  .
  c   p  p  p  p  p
  d   P  P  P  P  P
  e   .  R  .  B  K

Opening excerpt:
  1. Grok ▲P-76   opens the bishop diagonal
  1... GLM △P-34  mirrors the center fight
  2. Grok ▲P-26   prepares rook pressure
  2... GLM △P-84  challenges the file

Routes evaluated:
  route                 agent   move      clarity   safety    tempo    final_score
  grok_attack           Grok    ▲P-25     0.78      0.62      0.86     0.75
  glm_counter_watch     GLM     △P-85     0.70      0.76      0.72     0.73
  balanced_development  Grok    ▲S-68     0.86      0.90      0.80     0.87

Selected route:
  balanced_development

Next move:
  Grok ▲S-68

Why:
  Balanced development keeps Grok's attack alive while respecting GLM's counterplay.

Fadeout preview:
  Match continues after this opening excerpt...

Trace:
  ../../out/examples/best-route-game-trace.json

No external Grok/GLM model/API call was made. This is a deterministic demo fixture.
Summary: ../../out/examples/best-route-game-summary.md
```

Validation notes:

- Output contains `Mode: best_route`.
- Output contains `Fixture agents: Grok vs GLM`.
- Output contains a mini shogi board and an opening excerpt.
- Output contains `Selected route:` followed by `balanced_development`.
- Output contains `Next move:` followed by `Grok ▲S-68`.
- Output contains `Fadeout preview:`.
- Output does **not** contain `Mode: agent_chat`.
