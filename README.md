# QuorumRouter

MIT-licensed Deno control plane for fail-closed best-answer routing and
SafeLoop-authorized multi-role agent execution.

**Website:** https://sakamoto-sann.github.io/quorum-router/

## Quickstart

```bash
npx --yes create-quorum-router@latest my-quorum-router
cd my-quorum-router
deno task smoke
```

The NPX command above installs the provenance-backed npm release.
`deno task
smoke` is deterministic fixture-only and does **not** call a real
external provider API. Real provider commands require explicit opt-in and use
this machine's existing OAuth, wrapper, or CLI sessions. Generic API-key env
fallback is private/manual only and is not the primary launch proof.

Repo-local dogfood workspace:

```bash
deno task doctor
deno task models -- list
cd examples/local-model-dogfood
RUN_EXTERNAL_MODEL_DOGFOOD=1 deno task route:once --prompt "Review this README for risky claims."
RUN_EXTERNAL_MODEL_DOGFOOD=1 deno task best-route --prompt "Choose the safest launch copy."
RUN_EXTERNAL_MODEL_DOGFOOD=1 RUN_AGENT_CHAT=1 deno task agent-chat --prompt "Review this launch plan."
```

`route:once` and `best-route` accept
`--calibration-evidence ./calibration-evidence.json`; caller evidence is
validated before provider invocation and the advisory aggregate is included in
the route trace with task/source identifiers hashed.

Best Route/direct remains the production best-answer path. Conversation-only
Agent Chat is explicit opt-in. SafeLoop-backed Agent Chat provides a bounded
production repository execution slice. Its coder emits structured proposals, and
an injected SafeLoop client is the sole execution authority. The current real
SafeLoop execute-request API requires a distinct-actor approval bound to the
exact canonical digest for every repo or shell write. QuorumRouter does not
approve or sign policy and accepts only a strictly verified SafeLoop v1 receipt.

Dry-run the installer without changing the machine:

```bash
curl -fsSL https://raw.githubusercontent.com/sakamoto-sann/quorum-router/main/install.sh | sh -s -- --dry-run --ref main
```

## Demo 1 — Best Route

Best Route asks models for **independent candidates**. They do not talk to each
other. QuorumRouter compares the answers, explains the selection, and
synthesizes the strongest final answer.

[Watch the 15-second Best Route demo on YouTube](https://youtu.be/8GHw-9f1hjI)

```bash
RUN_EXTERNAL_MODEL_DOGFOOD=1 deno task best-route \
  --prompt "Find the race condition and propose the safest fix"
```

## Demo 2 — Agent Chat

Agent Chat is intentionally different: **two distinct working provider/model
identities share bounded conversation context and respond to each other over
multiple rounds**. The CLI prints every model identity, reply target, and
response as it arrives. If a discovered wrapper fails, participant establishment
safely tries the next candidate; fewer than two working identities fails closed.

[Watch the 26-second Agent Chat demo on YouTube](https://youtu.be/RYmaAOSCkF8)

```bash
RUN_EXTERNAL_MODEL_DOGFOOD=1 \
RUN_AGENT_CHAT=1 \
QUORUM_ROUTER_AGENT_CHAT_MAX_TURNS=6 \
  deno task agent-chat --prompt "Debate the safest migration plan"
```

Example live output:

```text
agents: OpenAI/codex-cli ↔ Cognition/devin-cli
Round 1
OpenAI/codex-cli → opening proposal
...
Round 2
Cognition/devin-cli → replying to OpenAI/codex-cli (round 1)
...
```

The recordings are deterministic CLI visualizations, while the command above is
the real wrapper-backed multi-model path. SafeLoop execution is a separate
authorization boundary; it is not a substitute for inter-model conversation.

## Modes

| Mode                      | Status                    | Purpose                            |
| ------------------------- | ------------------------- | ---------------------------------- |
| Best Route / direct       | Production-ready path     | Best-answer routing                |
| agent_chat (conversation) | Explicit read-only mode   | Multi-role review conversation     |
| agent_chat (execution)    | Production, bounded slice | SafeLoop-authorized repo execution |

Agent Chat and Commander contracts do not change default direct routing.

## Advisory calibration by task type

Use `aggregateTaskCalibration()` to summarize caller-attested evaluation results
for each task type and provider/model source. The report includes accuracy, mean
confidence, Brier score, signed mean calibration bias, and a configurable
sample-count status.

```ts
import { aggregateTaskCalibration } from "./router.ts";

const report = aggregateTaskCalibration([
  {
    observation_id: "review-001",
    task_type: "code_review",
    source: { provider: "OpenAI", model: "gpt-5" },
    evaluation_basis: "caller_attested_external_ground_truth",
    correct: true,
    confidence: 0.8,
    evaluated_at: "2026-07-13T00:00:00Z",
  },
], { minimum_sample_count: 20 });

console.log(report.groups[0]);
```

For narrower diagnostics, use `aggregateHierarchicalTaskCalibration()` and
`resolveHierarchicalTaskCalibration()`. Every labeled observation contributes to
its task group and, when present, its subtype and prompt-pattern groups. The
resolver selects the first sufficiently sampled group in
`prompt_pattern → task_subtype → task_type` order:

```ts
import {
  aggregateHierarchicalTaskCalibration,
  resolveHierarchicalTaskCalibration,
} from "./router.ts";

const source = { provider: "OpenAI", model: "gpt-5" };
const common = {
  task_type: "code_review",
  task_subtype: "typescript",
  source,
  evaluation_basis: "caller_attested_external_ground_truth" as const,
  correct: true,
  confidence: 0.8,
  evaluated_at: "2026-07-13T00:00:00Z",
};
const hierarchy = aggregateHierarchicalTaskCalibration([
  {
    ...common,
    observation_id: "review-001",
    prompt_pattern: "schema-boundary-review",
  },
  {
    ...common,
    observation_id: "review-002",
    prompt_pattern: "api-review",
  },
], { minimum_sample_count: 2 });

const selection = resolveHierarchicalTaskCalibration(hierarchy, {
  task_type: "code_review",
  task_subtype: "typescript",
  prompt_pattern: "schema-boundary-review",
  source,
});
console.log(selection.selected_scope); // "task_subtype"
```

Groups and fallback stay isolated by exact provider/model source. Subtype and
pattern values are caller-defined lowercase canonical labels, never raw prompts.

For outcome-level drift handling, the additive
`resolveHierarchicalTaskCalibrationWithDriftGuard()` API can quarantine a
sufficient child whose Brier score is materially worse than its immediate
parent, then continue parent fallback. It is explicit opt-in, not semantic label
verification, and never mutates labels or routing authority.

This is a pure, advisory API. QuorumRouter does not use its output to change
routing weights, ranks, eligibility, quorum, or execution. The caller must
establish evaluator trust, invocation binding, durable replay protection, and
canonical task/model identities before aggregation. See
[docs/calibration.md](docs/calibration.md) for the metric definitions and full
truth boundary.

## Local checks

```bash
deno task fmt
deno task check
deno task test
deno task smoke:v0.1
```

## Links

- npm installer: `npx --yes create-quorum-router@latest`
- website: https://sakamoto-sann.github.io/quorum-router/
- release: https://github.com/sakamoto-sann/quorum-router/releases/tag/v0.1.19
- launch notes: [docs/launch/](docs/launch/)
- release verification: [docs/release-runbook.md](docs/release-runbook.md)
- Hermes Agent on-demand integration:
  [integrations/hermes/](integrations/hermes/)
- examples: [examples/](examples/)
- SafeLoop AgentRuntime setup: [docs/agent-runtime.md](docs/agent-runtime.md)
- provider-native Prompt Caching:
  [docs/prompt-caching.md](docs/prompt-caching.md)
- benchmark methodology and current pilot results:
  [docs/bench.md](docs/bench.md)
- decision outcomes and disagreement evidence:
  [docs/decision-reports.md](docs/decision-reports.md)
- advisory calibration from externally evaluated task outcomes:
  [docs/calibration.md](docs/calibration.md)
- measurement-only ensemble quality (co-failure, regret, minority, diversity):
  [docs/ensemble-quality.md](docs/ensemble-quality.md)
- grounded non-answer offline shadow tooling and design (no routing authority):
  [docs/grounded-non-answer-evaluator.md](docs/grounded-non-answer-evaluator.md)
- research basis and evidence limits for ensemble quality:
  [docs/research-foundations.md](docs/research-foundations.md)
- verified model catalog, explicit config, and probes:
  [docs/model-catalog.md](docs/model-catalog.md)
- security notes: [docs/security.md](docs/security.md)

## License and boundaries

QuorumRouter is MIT-licensed open source.

Commercial and production use are permitted under the MIT License. The grant
applies retroactively to every version, commit, branch, and tag existing through
July 14, 2026, including `v0.1.0` through `v0.1.4`; see [LICENSE](LICENSE) and
[LICENSE-HISTORY.md](LICENSE-HISTORY.md).

SafeLoop v1 receipts are strictly verified by `SafeLoopCliClient` before they
reach the router. The caller can retain the same digest-bound guard at the use
site:

```typescript
const receipt = await client.executePrepared(prepared);
if (
  receipt.status !== "verified" ||
  receipt.binding.actionDigest !== prepared.request.action_digest
) {
  throw new Error("unverified SafeLoop receipt");
}
```

QuorumRouter does not contain an autonomous executor, policy engine, audit WAL,
artifact verifier, or rollback engine. Execution receipts and artifact evidence
must come from the injected SafeLoop authority. GitHub, database, external API,
release, policy, and credential mutations remain unsupported. Repo and shell
mutations are available only through the SafeLoop execute-request authority and
the confined structured-action worker. There are no live Supabase Agent Bus
runtime writes and no service-role runtime.
