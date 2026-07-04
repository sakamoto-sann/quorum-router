# Agent Chat Game GIF — Fusion Router v0.1 Public RC

> GIF 2. This is the experimental explicit opt-in `agent_chat` conversation
> demo. Do not describe it as Best Route mode or production autonomous runtime.

## Terminal recording commands

Recommended terminal: 100 columns x 32 rows, high-contrast dark theme, large
monospace font.

```bash
cd examples/agent-chat-game
deno task demo
```

Optional trace readback after the final frame:

```bash
cat ../../out/examples/agent-chat-game-summary.md
```

## Expected output

See
[`../../examples/agent-chat-game/expected-output.md`](../../examples/agent-chat-game/expected-output.md).

Required visible markers:

```text
Fusion Router v0.1 Public RC
Mode: agent_chat
Status: experimental explicit opt-in
Demo: Agent Chat Game
Commander:
Reviewer:
Red Team:
Closeout:
  Final answer: Door C.
Trace:
  ../../out/examples/agent-chat-game-trace.json
```

The output must **not** contain a Best Route score table.

## Caption options

1. “GIF 2: experimental Agent Chat mode solves a puzzle through explicit
   multi-role conversation.”
2. “Commander → Solver → Reviewer → Red Team → Closeout, using a deterministic
   fixture and no external model/API call.”
3. “`agent_chat` is explicit opt-in only; Best Route mode is a separate demo.”
4. “A role-conversation demo for the experimental surface, not a production
   autonomous runtime.”

## Alt text

Terminal recording of Fusion Router v0.1 Public RC running
`cd examples/agent-chat-game && deno task demo`. The output shows
`Mode: agent_chat`, `Status: experimental explicit opt-in`, a Three Doors role
turns for Commander, Solver, Reviewer, Red Team, and Closeout, final answer Door
C, and displayed trace path `../../out/examples/agent-chat-game-trace.json`.

## Short Product Hunt caption

GIF 2 shows experimental Agent Chat mode solving a puzzle through explicit
multi-role conversation: Commander, Solver, Reviewer, Red Team, and Closeout.

## Short X caption

GIF 2: experimental `agent_chat`. A deterministic role conversation solves the
Three Doors puzzle and corrects the tempting Door B answer to Door C.

## Claims to avoid

- Do not call Fusion Router open source.
- Do not claim `agent_chat` is production-ready.
- Do not claim production autonomous runtime.
- Do not imply this is Best Route mode.
- Do not show or describe a route score table here.
- Do not claim live Supabase Agent Bus runtime writes.
- Do not claim service-role runtime.
- Do not imply external model/API calls are required for this demo.
