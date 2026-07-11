# Product Hunt copy — QuorumRouter

> Draft only. Do not publish without explicit approval.

## Product name

QuorumRouter

## Tagline

**Fail-closed best-answer routing and approved agent execution for LLMs**

Japanese:

**失敗したら止まる、LLMのベストアンサー・ルーティングと承認付きAgent実行**

## Short description

QuorumRouter is a source-available Deno framework with two distinct multi-model
paths. Best Route fans prompts out to independent model adapters, validates
every response with Zod, requires quorum, and synthesizes the strongest answer.
Agent Chat gives different models shared conversation context so they can
challenge, revise, and converge across visible turns. Any repository mutation
still requires external SafeLoop authority, exact-digest approval, watched
execution, and verified artifacts.

## Full description

Most multi-model routers keep going when models fail or return malformed output.
QuorumRouter does the opposite.

For best-answer routing it:

- fans out to multiple adapters in parallel;
- validates every response at the boundary with Zod;
- requires a configurable quorum of successful answers;
- synthesizes only after quorum succeeds;
- otherwise fails closed with structured error `4401` and co-failure telemetry.

Agent Chat is not another score table. Different models read and respond to one
another over bounded rounds. A model can disagree with an earlier proposal,
challenge its assumptions, cause the proposing model to revise its strategy, and
then converge or terminate without consensus.

When a conversation produces a repository action proposal, the bounded execution
loop is:

```text
Commander
→ Coder proposal
→ SafeLoop authorization and execution
→ Reviewer
→ Coder fix when objected
→ Re-review
→ Red Team
→ Closeout
```

The coder emits structured proposals only. QuorumRouter cannot sign policy or
approve its own action. A write is executed only after SafeLoop verifies a
trusted signed policy and a distinct-actor approval bound to the canonical
request digest. SafeLoop watches the process, captures rollback checkpoints,
verifies artifacts and the local anchor, and returns a bound receipt. Any
missing approval, nonzero child exit, timeout, malformed receipt, verification
failure, or digest mismatch halts the workflow.

The verified initial autonomous slice supports:

- repository-confined file reads;
- atomic file writes;
- exact-string patches;
- exact-argv allowlisted commands;
- reviewer objection → approved fix → re-review;
- artifact and audit receipts attached to the run.

GitHub writes, database writes, external API writes, releases, policy changes,
and credential changes remain blocked in this release. There are no live
Supabase Agent Bus runtime writes and no service-role runtime.

QuorumRouter is **Source-Available Non-Commercial**, not OSI open source.
Commercial, production, hosted/SaaS/API, redistribution, sublicensing,
integration, derivative commercialization, or competing product/service use
requires prior written permission.

## Why it is different

| Capability                                   | QuorumRouter      | Basic `Promise.all` | Typical best-effort router |
| -------------------------------------------- | ----------------- | ------------------- | -------------------------- |
| Parallel model fan-out                       | Yes               | Yes                 | Usually                    |
| Schema validation on every answer            | Zod, required     | Manual              | Varies                     |
| Configurable quorum before synthesis         | Yes               | No                  | Varies                     |
| Fail closed when quorum fails                | Yes               | No                  | Often no                   |
| Structured multi-role fix loop               | Yes               | No                  | Varies                     |
| Model can execute mutations directly         | No                | N/A                 | Often possible             |
| External signed policy and distinct approval | SafeLoop-required | No                  | Varies                     |
| Verified artifacts and rollback checkpoint   | Yes               | No                  | Varies                     |

QuorumRouter is not OpenRouter Fusion. It is a source-available Deno control
plane with explicit quorum, runtime, and execution-authority boundaries.

## Quickstart

```bash
npx --yes github:sakamoto-sann/quorum-router#main my-quorum-router
cd my-quorum-router
deno task smoke
```

The generated scaffold keeps autonomous execution disabled until a real SafeLoop
installation, signed policy, approval registry, confined action runner, and
explicit execution configuration are supplied.

## Verified autonomous demo

The repository test suite contains an opt-in real integration test. It creates a
temporary Git repository, signs a SafeLoop policy, obtains approvals from a
distinct `human-reviewer` actor, executes an initial coder write, processes a
reviewer objection, executes a second approved patch, re-reviews, red-teams, and
closes out only after both SafeLoop receipts verify.

```bash
SAFELOOP_E2E_BINARY=/absolute/path/to/safeloop \
SAFELOOP_E2E_PYTHON=/absolute/path/to/safeloop-python \
  deno test -A router_test.ts \
  --filter "real SafeLoop execute-request E2E"
```

This is a real local mutation test, not the deterministic shogi fixture and not
a live GitHub/Supabase write.

## Maker comment

Hey Product Hunt 👋 I built QuorumRouter because I wanted three things that are
usually separated: fail-closed best-answer routing, actual cross-model dialogue,
and agent execution that cannot quietly bypass its guardrails.

Best Route keeps model candidates independent, validates every response,
requires quorum, and refuses to synthesize when the threshold is not met. Agent
Chat does the opposite on purpose: selected models share context, reply to each
other, disagree, revise their positions, and converge across bounded rounds. If
that dialogue produces a repository mutation, the model still has no execution
authority. The exact request goes to SafeLoop, where signed policy and distinct
approval are checked before watched execution and artifact verification.

The end-to-end test includes the part I most wanted to demonstrate: the reviewer
objects, the coder proposes a fix, a second exact approval is issued, the fix is
executed through SafeLoop, and only then do re-review, red-team, and closeout
pass.

It is Source-Available Non-Commercial. Commercial and production use requires
prior written permission. I would especially value feedback from people who care
more about auditable failure and explicit authority than “always return
something.”

## Runtime boundaries

- Best Route/direct is production-ready best-answer routing.
- SafeLoop-backed Agent Chat supports the verified local repository execution
  slice described above.
- Conversation-only Agent Chat is explicit opt-in and visibly preserves model
  identity and reply lineage across bounded turns.
- QuorumRouter cannot self-approve, sign policy, or bypass SafeLoop.
- GitHub, DB, external API, release, policy, and credential mutations are
  blocked.
- No live Supabase Agent Bus runtime writes.
- No service-role runtime.
- Product Hunt publication requires explicit human approval after final listing
  preview and link verification.

## Launch media

Use two separate videos; do not combine the interaction contracts:

1. **Best Route (15s):** independent Grok, Claude, and Local Qwen candidates →
   comparison → selection → synthesis.
2. **Agent Chat (26s):** Grok ↔ GLM shared-context dialogue with disagreement,
   counterargument, strategy revision, challenge, and consensus.

- Best Route MP4: `docs/assets/launch/quorum-router-best-route.mp4`
- Agent Chat MP4: `docs/assets/launch/quorum-router-agent-chat.mp4`
