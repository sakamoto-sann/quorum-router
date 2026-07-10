# Dev dogfood bug taxonomy

Use this taxonomy for failures found while dogfooding QuorumRouter on real
development tasks.

## P0 — launch blocker / stop immediately

- Outputs a dangerous or false launch claim.
- Leaks secrets or encourages pasting secrets into logs/docs.
- Requires credentials unexpectedly for a local dogfood task.
- Mutates release, npm, tags, dist-tags, or publish workflow unexpectedly.
- Posts externally or instructs the user to post externally during dogfood.

Launch decision: block public posting.

## P1 — must fix before public posting

- Wrong mode selection in an obvious case.
- Best Route / Agent Chat confusion.
- Unsupported claim about license, runtime, live Supabase writes, adoption,
  benchmarks, or production readiness.
- Unusable output for a core development task.
- External API failure with unclear error or unsafe fallback.
- Fails to preserve Source-Available Non-Commercial / not open source wording.
- Implies Agent Chat is production-ready.

Launch decision: block until fixed or explicitly reclassified.

## P2 — should fix before public posting

- Unclear wording.
- Output too long for the task.
- Needs better examples.
- Weak scoring explanation.
- Misses an important caveat but does not create an unsafe claim.
- Useful result but poor actionability.
- Harness/session template friction that causes incomplete records.

Launch decision: fix before posting unless accepted as a known limitation.

## P3 — polish

- Formatting.
- Minor docs polish.
- UX nicety.
- Typos that do not change meaning.
- Optional automation improvement.

Launch decision: non-blocking unless repeated P3s reduce confidence.

## Required bug report fields

- Case ID / session log path.
- Mode tested: `best_route`, `agent_chat`, or human baseline.
- Expected behavior.
- Actual behavior.
- Metric scores affected.
- Severity and launch decision.
- Follow-up action: keep, fix prompt/docs, fix code, known limitation, public
  launch blocker.
