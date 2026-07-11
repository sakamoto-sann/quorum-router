# X launch drafts — QuorumRouter

> Draft only. Publish only after explicit approval of the final post preview.

Repository: https://github.com/sakamoto-sann/quorum-router

## Short launch post

QuorumRouter gives multi-model systems two deliberately different paths:

1. Best Route: independent candidates → validation → quorum → selection →
   synthesis.
2. Agent Chat: different models share context, challenge each other, revise, and
   converge across visible turns.

If a conversation proposes a repository mutation, SafeLoop—not the model—owns
authorization, watched execution, and verification.

Source-Available Non-Commercial.

## Two-video thread

### 1/6

Most “multi-model” demos blur two different ideas:

- asking several models independently and choosing the best answer;
- letting different models actually talk to one another.

QuorumRouter supports both, but keeps the contracts separate.

https://github.com/sakamoto-sann/quorum-router

### 2/6 — Best Route video

Best Route keeps candidates isolated.

Grok, Claude, and Local Qwen answer independently. QuorumRouter validates the
responses, compares capability/evidence/safety/diversity, and synthesizes the
strongest final answer.

No model-to-model conversation in this mode.

Attach: `docs/assets/launch/quorum-router-best-route.mp4`

### 3/6 — Agent Chat video

Agent Chat is actual cross-model dialogue.

Grok proposes a move. GLM reads it and disagrees. Grok changes strategy. GLM
challenges the revision. Grok answers. GLM converges.

The CLI keeps model identity and `replying to` lineage visible across six
rounds.

Attach: `docs/assets/launch/quorum-router-agent-chat.mp4`

### 4/6

The distinction:

```text
Best Route
independent answers → router synthesis

Agent Chat
Grok ↔ GLM → disagreement → revision → consensus
```

Agent Chat is not another score table, and execution status is not a substitute
for model-to-model conversation.

### 5/6

When dialogue produces a mutation proposal, QuorumRouter still cannot execute or
self-approve it.

SafeLoop checks signed policy and distinct approval bound to the exact request
digest, watches execution, verifies artifacts, and returns a receipt. Failure
halts the workflow.

### 6/6

Try the source-backed scaffold directly from `main`:

```bash
npx --yes github:sakamoto-sann/quorum-router#main my-quorum-router
cd my-quorum-router
deno task smoke
```

Source-Available Non-Commercial; not OSI open source. Commercial or production
use requires prior written permission.

## Media truth boundary

The two launch recordings are deterministic CLI visualizations. Do not describe
them as recordings of live Grok, Claude, GLM, or Qwen API traffic. The mode
semantics and visible turn lineage mirror the implemented product contracts.
