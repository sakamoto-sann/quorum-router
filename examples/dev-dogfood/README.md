# Dev dogfood harness

This optional local harness helps create empty session logs for real Fusion
Router development dogfood tasks.

It does **not** call external APIs, does **not** use credentials, and does
**not** pretend to evaluate automatically. The human tester still runs or
evaluates the task and fills the scores.

## Create a session log

```bash
cd examples/dev-dogfood
deno task new-session
```

Choose a specific sample task:

```bash
deno task new-session -- DOC-001
```

List sample tasks:

```bash
deno task list
```

The harness intentionally ships a small starter set of sample tasks. Use the
full casebook in `docs/dogfood/` for the complete real-dev dogfood matrix.

Output logs are written under:

```text
out/dogfood/dev-sessions/
```

That directory is ignored by git.
