# Demo GIF shot list — Fusion Router v0.1 Public RC

> Screen recording plan only. Do not create a video/GIF unless explicitly
> requested.

## Terminal size

- Recommended size: 100 columns x 32 rows.
- Theme: high contrast dark background, readable monospace font.
- Font size: large enough for mobile preview.
- Hide unrelated shell prompt decorations if possible.

## Commands to type

Type commands manually or paste one at a time:

```bash
npx --yes create-fusion-router@latest my-fusion-router-demo
cd my-fusion-router-demo
find . -maxdepth 2 -type f | sort
cat deno.json
cat main.ts
deno task check
deno task smoke
```

## Pacing

1. Start with an empty terminal in a temp directory.
2. Pause briefly before the NPX command so viewers can read it.
3. Let the scaffold output stay visible for 1–2 seconds.
4. Run `find` and pause on the three generated files.
5. Show `deno.json` for 2–3 seconds; do not dwell on every line.
6. Show `main.ts` with a slow scroll only if needed.
7. Run `deno task check`; pause on successful check.
8. Run `deno task smoke`; pause on `"ok": true`.

## Where to pause

- On the NPX quickstart command.
- On the generated file list:

```text
./README.md
./deno.json
./main.ts
```

- On the `deno task smoke` result containing `"ok": true`.

## Final frame

Final frame should show the smoke JSON with `"ok": true` visible and, if space
allows, a short terminal comment above or below:

```text
Fusion Router v0.1 Public RC — direct best-answer routing demo
```

## Caption options

1. “Fusion Router v0.1 Public RC: NPX scaffold to Deno smoke in under a minute.”
2. “Routing first, agents second. `direct` is the production-ready best-answer
   path; `agent_chat` is experimental opt-in.”
3. “A tiny generated demo: README, deno.json, main.ts, and `"ok": true`.”
4. “Source-Available Non-Commercial. Not open source. Check the license before
   commercial or production use.”

## Alt text

Terminal recording showing
`npx --yes create-fusion-router@latest my-fusion-router-demo`, a generated
Fusion Router demo with `README.md`, `deno.json`, and `main.ts`, followed by
`deno task check` and `deno task smoke` completing successfully with JSON output
containing `"ok": true`.

## Social preview text

Fusion Router v0.1 Public RC — source-available best-answer routing for LLM
adapters.

```bash
npx --yes create-fusion-router@latest my-fusion-router-demo
cd my-fusion-router-demo
deno task smoke
```

`direct` is production-ready. `agent_chat` is experimental explicit opt-in only.
Source-Available Non-Commercial; not open source.
