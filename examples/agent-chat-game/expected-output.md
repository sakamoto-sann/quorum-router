# Expected output — Agent Chat Game

```text
Fusion Router v0.1 Public RC
Mode: agent_chat
Status: experimental explicit opt-in
Demo: Agent Chat Game

Game:
  Three doors: A, B, C.
  Find the treasure.

Commander:
  Let's list the clues and possible contradictions.

Solver:
  Door B looks plausible at first.

Reviewer:
  Door B conflicts with clue 2.

Red Team:
  Check if Door C is the only answer that avoids the trap.

Closeout:
  Final answer: Door C.

Final:
  Door C

Trace:
  ../../out/examples/agent-chat-game-trace.json

No external model/API call was made. This is a deterministic demo fixture.
Summary: ../../out/examples/agent-chat-game-summary.md
```

Validation notes:

- Output contains `Mode: agent_chat`.
- Output contains `experimental explicit opt-in`.
- Output contains `Commander:`, `Reviewer:`, and `Red Team:`.
- Output contains `Final answer: Door C`.
- Output does **not** contain a best-route scoring section.
