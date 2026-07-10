# Agent Chat Shogi GIF — QuorumRouter v0.1 public preview

> GIF 2. This is the conversation-only `agent_chat` fixture demo, not the
> production SafeLoop execution demo. Do not describe it as Best Route mode or a
> live Grok/GLM model call.

![Agent Chat mode demo](../assets/launch/fusion-router-agent-chat-game.gif)

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
QuorumRouter v0.1 public preview
Mode: agent_chat
Status: experimental explicit opt-in
Demo: Mini Shogi Opening Excerpt
Fixture agents: Grok vs GLM
Partial match:
1. Grok:
1... GLM:
3... GLM:
Fadeout:
  Match continues after this opening excerpt...
Trace:
  ../../out/examples/agent-chat-game-trace.json
```

The output must **not** contain a Best Route score table.

## Caption options

1. “GIF 2: experimental Agent Chat mode shows a Grok vs GLM shogi excerpt.”
2. “Grok and GLM alternate a few opening moves, then the demo fades out before
   the full match.”
3. “`agent_chat` is explicit opt-in only; Best Route mode is a separate demo.”
4. “A deterministic role-conversation fixture, not a production autonomous
   runtime or live model/API call.”

## Alt text

Terminal recording of QuorumRouter v0.1 public preview running
`cd examples/agent-chat-game && deno task demo`. The output shows
`Mode: agent_chat`, `Status: experimental explicit opt-in`, fixture agents
`Grok vs GLM`, a simple mini shogi board, six opening half-moves, a fadeout line
saying the match continues after the excerpt, and displayed trace path
`../../out/examples/agent-chat-game-trace.json`.

## Short Product Hunt caption

GIF 2 shows experimental Agent Chat mode with a deterministic Grok vs GLM shogi
excerpt: a few opening moves, then a fadeout before the full match.

## Short X caption

GIF 2: experimental `agent_chat`. Grok and GLM alternate a short shogi opening
excerpt, then the demo fades out before the full match.

## Claims to avoid

- Do not call QuorumRouter open source.
- Do not claim real Grok or GLM external model/API calls are made.
- Do not claim `agent_chat` is production-ready.
- Do not claim production autonomous runtime.
- Do not imply this is Best Route mode.
- Do not show or describe a route score table here.
- Do not claim live Supabase Agent Bus runtime writes.
- Do not claim service-role runtime.
