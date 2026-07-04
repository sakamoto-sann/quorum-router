# Expected output — Best Route Game

```text
Fusion Router v0.1 Public RC
Mode: best_route
Demo: Best Route Game

Game:
  Three doors: A, B, C.
  One has treasure.
  The clues are partially ambiguous.

Routes evaluated:
  fast_direct
  structured_direct
  guarded_direct

Score table:
  route               answer    confidence    consistency    risk    final_score
  fast_direct         Door B    0.62          0.40           low     0.62
  structured_direct   Door C    0.78          0.92           low     0.88
  guarded_direct      Door C    0.73          0.88           low     0.81

Selected route:
  structured_direct

Final answer:
  Door C

Why:
  Highest clue-consistency score with low risk.

Trace:
  ../../out/examples/best-route-game-trace.json

No external model/API call was made. This is a deterministic demo fixture.
Summary: ../../out/examples/best-route-game-summary.md
```

Validation notes:

- Output contains `Mode: best_route`.
- Output contains `Selected route:`.
- Output contains `Final answer:` followed by `Door C`.
- Output does **not** contain role-conversation labels.
