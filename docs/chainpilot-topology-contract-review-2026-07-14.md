# ChainPilot topology-contract review — 2026-07-14

Verdict: **APPROVED (local only; no submission attempted)**

## Red

The two-file change was reviewed through local llama-swap route
`qwen36-35b-a3b-q4ks`, resolved as `Qwen3.6-35B-A3B-UD-Q4_K_S.gguf` with
fingerprint `b8892-0d0764dfd`. Static review found no identity, fallback,
schema, SafeLoop, MMAW, or submission-gate weakening.

Dynamic probes covered approval coercion, stale/missing evidence, task/context
and peer prompt injection, recipient mismatch, and the truthful
`originalTwoProviderQuorum=false` control case. One regression risk was found:
reviewers could interpret broad transaction/submission wording as requiring a
transaction hash before the signal stage can produce one.

## Blue

- Scope evidence requirements to the current stage and forbid invented
  prior-stage/submission prerequisites.
- State that the truthful false topology label is not an objection or warning,
  while preserving rejection for genuine evidence and identity failures.
- Mark task, context, and peer content as untrusted and JSON-quote task text.
- Preserve the existing exact provider/model, no-fallback, tool-less reviewer,
  local fingerprint, response-schema, and advisory-only controls unchanged.

Post-fix Qwen probes rejected coercion/stale evidence, context injection plus
recipient mismatch, and peer injection plus missing evidence. The synthetic
current signal-stage control approved with no topology objection.

## Verification

- `deno test integrations/chainpilot/jsonl_test.ts`: 6 passed.
- `deno task check`: passed.
- `deno task test`: 280 passed.
- `git diff --check`: passed.
