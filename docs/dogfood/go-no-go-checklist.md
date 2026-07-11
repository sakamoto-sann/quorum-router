# Go / no-go checklist

Use this checklist after running `manual-qa-runbook.md` and filling at least one
manual session log.

## Decision states

- **GO**: all must-pass checks pass, at least one non-author end-to-end session
  passes, and no P0/P1 remains open.
- **NO-GO**: any must-pass check fails, any P0/P1 remains open, or a disallowed
  public claim is visible.
- **GO with known limitations**: all must-pass checks pass, only can-ship
  limitations remain, and limitations are documented clearly.

## Must-pass before public posting

- [ ] NPX latest works in a clean temp directory.
- [ ] NPX pinned `@0.1.4` works after publish approval.
- [ ] Generated demo `deno task check` passes.
- [ ] Generated demo `deno task smoke` passes.
- [ ] Generated demo `deno task smoke` is understood as fixture-only, not real
      provider dogfood.
- [ ] Repo-local `(cd examples/local-model-dogfood && deno task intake)`
      reflects the user's actual local wrapper/session/provider state.
- [ ] Generated demo `deno task intake`, `deno task auth:status`,
      `deno task models:list`, and `deno task health` pass without printing
      provider credentials.
- [ ] Repo-local `RUN_EXTERNAL_MODEL_DOGFOOD=1 deno task route:once` passes with
      a local wrapper/session provider, or unavailable providers are marked with
      exact blockers.
- [ ] Generic API-key env fallback is not treated as the primary launch proof.
- [ ] Generated demo `RUN_EXTERNAL_MODEL_DOGFOOD=1 deno task route:once` passes
      at least once with a real external provider.
- [ ] Generated demo `RUN_EXTERNAL_MODEL_DOGFOOD=1 deno task best-route` passes
      for Grok + Devin + Codex/OpenAI + local Qwen + Claude/Gemini, or
      unavailable providers are explicitly documented with primary evidence.
- [ ] External dogfood trace is reviewed and contains no provider credential
      values.
- [ ] Best Route demo runs and stays separate from Agent Chat.
- [ ] Agent Chat demo runs and clearly states experimental explicit opt-in.
- [ ] README quickstart works.
- [ ] README GIFs render.
- [ ] npm latest points to the approved external-dogfood package version after
      explicit publish approval.
- [ ] No false open-source claim.
- [ ] No production autonomous runtime claim.
- [ ] No service-role/live Supabase runtime claim.
- [ ] No secrets or credentials required for fixture smoke / CI.
- [ ] External provider credentials are required only for manual opt-in external
      dogfood and are never committed.
- [ ] At least one non-author manual test session passes end-to-end.

## Should-fix before public posting

These do not automatically block every launch, but should be fixed unless the
owner explicitly accepts them as known limitations.

- [ ] No confusing error message remains.
- [ ] Mode separation is clear.
- [ ] GIFs are readable and not too fast.
- [ ] README is not too long.
- [ ] Product Hunt/X copy is not too long.
- [ ] Installation time is acceptable.
- [ ] No platform-specific failure remains on a common setup.

## Can-ship known limitations

These can be documented and accepted if must-pass items are green:

- [ ] Deno required.
- [ ] Network required for remote module resolution.
- [ ] `agent_chat` is a deterministic demo fixture / experimental.
- [ ] MIT permits commercial use.
- [ ] npm latest may remain 0.1.3 until explicit v0.1.4 publish approval.

## Required readbacks before GO

Record exact values:

| Item                     | Value / evidence |
| ------------------------ | ---------------- |
| main HEAD                |                  |
| `origin/main` HEAD       |                  |
| v0.1.3 release URL       |                  |
| v0.1.3 release target    |                  |
| npm latest               |                  |
| NPX latest smoke         |                  |
| NPX pinned smoke         |                  |
| External provider check  |                  |
| External provider once   |                  |
| External dogfood trace   |                  |
| Best Route demo          |                  |
| Agent Chat demo          |                  |
| Non-author manual tester |                  |

## Final recommendation

- [ ] GO
- [ ] NO-GO
- [ ] GO with known limitations

Reason:
