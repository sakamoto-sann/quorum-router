# Terminal demo script — QuorumRouter

> Script for recorded or live terminal demos. Do not claim open source
> licensing. Do not claim production autonomous runtime. Do not claim live
> Supabase Agent Bus runtime writes. Do not claim service-role runtime. `Grok`
> and `GLM` are deterministic fixture labels here, not live external model
> calls.

## Two separate GIFs

Use two separate recordings so external viewers do not confuse Best Route mode
with experimental Agent Chat mode.

| GIF   | Command                                         | Message                                                                               |
| ----- | ----------------------------------------------- | ------------------------------------------------------------------------------------- |
| GIF 1 | `cd examples/best-route-game && deno task demo` | Best Route mode chooses a next move in a Grok vs GLM shogi excerpt.                   |
| GIF 2 | `cd examples/agent-chat-game && deno task demo` | Experimental Agent Chat mode shows a short Grok vs GLM shogi excerpt, then fades out. |

## GIF 1 script — Best Route shogi excerpt

```bash
cd examples/best-route-game
deno task demo
```

Narration:

- “This is QuorumRouter.”
- “Mode is `best_route`.”
- “The fixture agents are Grok and GLM; no external model/API call is made.”
- “The demo shows a simple shogi opening excerpt.”
- “Best Route compares candidate next-move lines.”
- “The production-ready best-answer path selects `balanced_development`.”
- “The next move is `Grok ▲S-68`.”
- “The clip fades out here rather than showing the full match.”

Do **not** mention `agent_chat` or role-conversation framing in this GIF.

## GIF 2 script — Agent Chat shogi excerpt

```bash
cd examples/agent-chat-game
deno task demo
```

Narration:

- “This is the separate `agent_chat` demo.”
- “This shogi recording is the conversation-only `agent_chat` fixture; the
  production execution proof is the separate real SafeLoop E2E.”
- “The fixture agents are Grok and GLM; no external model/API call is made.”
- “Grok and GLM alternate a few shogi opening moves.”
- “The match continues, but the demo fades out before the full game.”
- “No external model/API call was made; this is a deterministic fixture.”

Do **not** describe this GIF as Best Route mode.

## Existing NPX quickstart clip

The NPX quickstart remains useful as an install/scaffold clip, but it should not
replace the two mode-specific GIFs.

```bash
npx --yes create-quorum-router@latest my-quorum-router
cd my-quorum-router
deno task smoke
```

Use it only for “install to smoke” messaging. Use the two GIFs for mode
positioning.

## What to say in launch copy

- “GIF 1 shows Best Route mode choosing a shogi next move.”
- “GIF 2 shows experimental Agent Chat mode with a short Grok vs GLM shogi
  excerpt.”
- “The two demos are intentionally separate.”
- “Best Route is the production-ready best-answer routing path.”
- “`agent_chat` is an explicit opt-in conversation mode.”
- “Grok and GLM are deterministic fixture labels in the recording, not live API
  calls.”
- “QuorumRouter is MIT, open source.”

## What not to claim

- “Grok/GLM were called live in the demo.”
- “Agent Chat is production-ready.”
- “Best Route always uses Agent Chat.”
- “Production autonomous runtime.”
- “Live Supabase Agent Bus runtime writes.”
- “Service-role runtime.”
