# Agent Chat Shogi demo

This demo is **GIF 2** for QuorumRouter v0.1 public preview.

It shows **Agent Chat mode** as an **experimental explicit opt-in** conversation
demo. A deterministic fixture transcript shows `Grok` and `GLM` alternating a
few moves from a simple shogi opening excerpt, then fading out before the full
match.

The fixture agents are named `Grok` and `GLM`, but no external Grok/GLM
model/API call is made.

It is intentionally **not** Best Route mode.

## Run

```bash
cd examples/agent-chat-game
deno task demo
```

## What it proves

- `Mode: agent_chat` is visually explicit.
- The status is `experimental explicit opt-in`.
- Fixture agents are shown as `Grok vs GLM`.
- Grok and GLM alternate a short shogi opening excerpt.
- The clip fades out before showing a full match.
- No external model/API call is made.
- No credentials or secrets are required.

## What it does not show

- No Best Route score table.
- No production-ready `agent_chat` claim.
- No live Grok/GLM API call.
- No production autonomous runtime claim.
- No live Supabase Agent Bus runtime writes.
- No service-role runtime.

## Generated artifacts

Running the demo writes deterministic trace artifacts:

- `out/examples/agent-chat-game-trace.json`
- `out/examples/agent-chat-game-summary.md`

The trace JSON records `mode: "agent_chat"`, `explicit_opt_in: true`,
`status: "experimental"`, fixture agents, partial match turns, fadeout note,
no-external-call note, deterministic fixture note, and runtime boundaries.
