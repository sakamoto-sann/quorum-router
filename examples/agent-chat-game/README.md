# Agent Chat Game demo

This demo is **GIF 2** for Fusion Router v0.1 Public RC.

It shows **Agent Chat Game mode** as an **experimental explicit opt-in**
conversation demo. A deterministic multi-role transcript solves the same small
Three Doors puzzle through Commander, Solver, Reviewer, Red Team, and Closeout
turns.

It is intentionally **not** Best Route mode.

## Run

```bash
cd examples/agent-chat-game
deno task demo
```

## What it proves

- `Mode: agent_chat` is visually explicit.
- The status is `experimental explicit opt-in`.
- The game is solved through role turns:
  - Commander
  - Solver
  - Reviewer
  - Red Team
  - Closeout
- Reviewer and Red Team correct the tempting `Door B` path.
- The final answer is `Door C`.
- No external model/API call is made.
- No credentials or secrets are required.

## What it does not show

- No Best Route score table.
- No production autonomous runtime claim.
- No live Supabase Agent Bus runtime writes.
- No service-role runtime.

## Generated artifacts

Running the demo writes deterministic trace artifacts:

- `out/examples/agent-chat-game-trace.json`
- `out/examples/agent-chat-game-summary.md`

The trace JSON records `mode: "agent_chat"`, `explicit_opt_in: true`,
`status: "experimental"`, role turns, final answer, reviewer/red-team
correction, no-external-call note, deterministic fixture note, and runtime
boundaries.
