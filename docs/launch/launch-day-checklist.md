# Launch-day checklist

Public Product Hunt/X launch is currently **NO-GO** until local real-model
dogfood passes in the user's own environment. NPX is not the goal; it is only a
distribution/demo surface after repo-local dogfood is usable.

## Hard stops

- [ ] Do not post Product Hunt/X until this checklist is fully green.
- [ ] Do not publish npm without explicit approval.
- [ ] Do not mutate npm dist-tags without explicit approval.
- [ ] Do not mutate v0.1.0 / v0.1.1 / v0.1.2 / v0.1.3 tags/releases.
- [ ] Do not run the publish workflow without explicit approval.
- [ ] Do not expose provider credentials, npm tokens, passwords, or OTP.

## External dogfood gate

- [ ] Generated `deno task smoke` passes and is recorded as fixture-only.
- [ ] Repo-local `examples/local-model-dogfood deno task intake` reads actual
      local wrapper/session/provider state.
- [ ] Repo-local `RUN_EXTERNAL_MODEL_DOGFOOD=1 deno task route:once` passes with
      a real local wrapper/session/provider.
- [ ] Generic API-key env fallback is not used as the primary launch proof.
- [ ] Generated `deno task intake`, `deno task auth:status`,
      `deno task models:list`, and `deno task health` pass without secrets.
- [ ] `RUN_EXTERNAL_MODEL_DOGFOOD=1 deno task route:once` passes once with a
      real OAuth/session/wrapper provider.
- [ ] `RUN_EXTERNAL_MODEL_DOGFOOD=1 deno task best-route` passes for the
      current-provider gate, or every unavailable provider is explicitly
      documented.
- [ ] `out/route-once-trace.json` or `out/best-route-trace.json` exists.
- [ ] Trace has `schema_valid: true`.
- [ ] Trace has `redaction_ok: true`.
- [ ] Trace has the no-API-key boolean set to true.
- [ ] Trace contains no provider credential values.

## Claim boundaries

- [ ] Fixture smoke is not described as real provider dogfood.
- [ ] External dogfood is manual opt-in only and not run in CI.
- [ ] Best Route/direct remains production-ready best-answer routing.
- [ ] `agent_chat` remains experimental explicit opt-in only.
- [ ] SafeLoop-backed Agent Chat production execution claims are limited to the
      verified local repository slice with signed policy and distinct approval.
- [ ] No live Supabase Agent Bus runtime writes claim.
- [ ] No service-role runtime claim.
- [ ] QuorumRouter remains Source-Available Non-Commercial / not open source.

## Release/publish follow-up

After external dogfood passes and the user explicitly approves release:

- [ ] Prepare v0.1.4 release/tag.
- [ ] Align generated runtime import with v0.1.4.
- [ ] Publish `create-quorum-router@0.1.4` only after npm auth/publish gates
      pass.
- [ ] Verify npm latest points to 0.1.4.
- [ ] Re-run NPX latest smoke and external dogfood check.
