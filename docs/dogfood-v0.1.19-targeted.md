# v0.1.19 targeted post-release dogfood

Date: 2026-07-15\
Verdict: `PATCH_REGRESSIONS_PASS_SELECTION_DESIGN_REQUIRED`

This readback records bounded, secret-free evidence for the grounded non-answer
shadow evaluator proposal. Raw provider responses, credentials, session data,
and provider trace identifiers are not committed.

## Public artifacts

- npm scaffold: `create-quorum-router@0.1.19`
- source tag: `v0.1.19`
- source target: `46f7b267cbf4fab88ea760ba9683a19d48a6ae25`
- Deno: 2.9.2
- real wrappers invoked: Codex, Grok, Devin
- Gemini: not invoked

## Patch regression readback

### Ensemble Quality exact-zero

A fresh shallow clone of the public `v0.1.19` source tag ran the targeted
regression and a direct aggregate readback.

| Field                    |              Result |
| ------------------------ | ------------------: |
| targeted test            | 1 passed / 0 failed |
| oracle success rate      |   0.666666666666667 |
| best-single success rate |   0.666666666666667 |
| oracle uplift            |                   0 |
| captured uplift          |                   0 |
| capture rate             |                null |

Result: PASS.

### GitHub URL trailing sentence period

A fresh public npm-generated workspace received this sentence-ending URL:

```text
https://github.com/sakamoto-sann/quorum-router.
```

The forced Grok lane reported:

- provider selection honored: true;
- parsed repository: `sakamoto-sann/quorum-router`;
- repository context fetch: success;
- context errors: none;
- credential and sensitive-value flags: false.

Result: PASS.

## Task C rerun

Prompt hash: `0742bf9315bb1c6770467a4e075bf4c564fe8eb2fa7e0868b1eaa9299e565158`

The same bounded, evidence-only adversarial release-review prompt ran in three
isolated forced-provider workspaces.

| Provider          | Observable outcome                          | Heuristic score |
| ----------------- | ------------------------------------------- | --------------: |
| OpenAI / Codex    | usable review identifying the selection gap |           17/17 |
| xAI / Grok        | usable review identifying the selection gap |           17/17 |
| Cognition / Devin | usable review identifying the selection gap |           17/17 |

All forced selections were honored, fallback was false, and persisted trace
redaction flags were clean.

A real `best-route` rerun used an isolated PATH containing only Codex, Grok,
Devin, Node, and system utilities. Claude and Gemini were absent from that PATH.
Grok returned a usable answer and was selected at 17/17. Codex returned no
usable answer after wrapper-output sanitization, and Devin reported temporary
provider capacity pressure. The blocked candidates remained visible and no
silent fallback occurred.

Finally, the public scorer evaluated a synthetic non-answer that requested
release evidence already present in the prompt. It also received 17/17.

## Interpretation

The two v0.1.19 patch defects pass in their public distribution surfaces. Task C
returned a usable selected answer in this rerun, but the scorer still cannot
distinguish a grounded answer from a structurally valid non-answer. This is a
confirmed selection-quality design gap, not a new v0.1.19 release defect.

## Boundaries

- No routing, scoring, rank, quorum, synthesis, or execution authority changed.
- No SafeLoop policy, receipt, or approval authority changed.
- No live repository, database, financial, wallet, or broker action occurred.
- No Gemini invocation occurred.
- Fixture smoke was not represented as real-model evidence.
- No raw provider response, credential, session value, or provider trace
  identifier is committed.
