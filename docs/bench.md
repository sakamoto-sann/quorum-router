# Model strategy benchmark

This pilot compares one model call, Structured Fusion (independent candidates →
Structured Judge → Editor), and bounded Agent Chat on the same three prompts. It
is intended to make the quality/cost trade-off inspectable, not to claim a
universal leaderboard.

## July 11, 2026 pilot

| Strategy                       | Rubric win rate¹ | Mean rubric coverage | Model calls/task | Mean input tokens | Mean output tokens | Input-token multiplier |
| ------------------------------ | ---------------: | -------------------: | ---------------: | ----------------: | -----------------: | ---------------------: |
| Single model                   |            11.1% |                72.2% |                1 |            16,659 |                314 |                  1.00× |
| Best Route / Structured Fusion |            27.8% |                77.8% |                4 |            71,462 |              1,492 |                  4.29× |
| Agent Chat (4 turns)           |        **61.1%** |            **83.3%** |                4 |            74,398 |              1,321 |                  4.47× |

¹ Three tasks: a zero-downtime 500M-row schema migration, a TypeScript edge-case
fix, and payment-webhook verification. Each answer was checked against a
predeclared six-item keyword-group rubric. For each task, one win went to the
strategy with the highest coverage; tied strategies shared that win equally.
Coverage is a deterministic concept-match proxy, not semantic correctness. The
per-task scores and full answers are preserved in
[`bench-results-2026-07-11.json`](bench-results-2026-07-11.json).

## What was actually run

- Real OAuth-backed Codex CLI calls; no fixture answers and no API-key fallback.
- Candidate identities: `gpt-5.4-mini` and `gpt-5.6-sol`; Judge/Editor:
  `gpt-5.4`.
- Single model: one `gpt-5.4-mini` answer.
- Best Route: two independent candidates, one structured Judge call, one Editor
  call.
- Agent Chat: four alternating turns; the fourth, converged turn was scored.
- Provider-reported token usage was recorded from Codex JSONL events.

This run uses distinct model identities behind one CLI/provider, not independent
vendors. It therefore measures the routing strategy in the available local
model-dogfood environment; it does **not** establish cross-provider superiority.
The sample is small (`n=3`), so the results are directional and should be rerun
on an organization's own task set before procurement.

## Cost interpretation

ChatGPT OAuth does not expose a reliable per-call dollar charge. The table uses
provider-reported input/output tokens and model-call count as auditable cost
proxies instead of inventing a dollar figure. Cached input tokens are retained
in the raw result file because provider billing treatment can differ.

## Reproduce

The runner performs live external model calls and is intentionally not part of
the default test suite:

```bash
QUORUM_BENCH_OUTPUT=docs/bench-results.json \
  python3 scripts/run-model-strategy-bench.py
```

Review the generated JSON before publishing it. Model availability, OAuth plan,
prompt versions, and provider behavior can change the result.
