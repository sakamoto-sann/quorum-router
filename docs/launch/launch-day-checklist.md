# Launch-day checklist

Public Product Hunt/X launch is currently **NO-GO** until external provider
dogfood passes.

## Hard stops

- [ ] Do not post Product Hunt/X until this checklist is fully green.
- [ ] Do not publish npm without explicit approval.
- [ ] Do not mutate npm dist-tags without explicit approval.
- [ ] Do not mutate v0.1.0 / v0.1.1 / v0.1.2 / v0.1.3 tags/releases.
- [ ] Do not run the publish workflow without explicit approval.
- [ ] Do not expose provider credentials, npm tokens, passwords, or OTP.

## External dogfood gate

- [ ] Generated `deno task smoke` passes and is recorded as fixture-only.
- [ ] Generated `deno task external:check` passes on a credentialed machine.
- [ ] `RUN_EXTERNAL_MODEL_DOGFOOD=1 deno task external:once` passes once with a
      real external provider.
- [ ] `RUN_EXTERNAL_MODEL_DOGFOOD=1 deno task external:matrix` passes for the
      current-provider gate: Grok + Devin + OpenAI + local Qwen + GLM, or every
      unavailable provider is explicitly documented.
- [ ] `out/external-dogfood/external-once-trace.json` exists.
- [ ] Trace has `schema_valid: true`.
- [ ] Trace has `redaction_ok: true`.
- [ ] Trace has the no-API-key boolean set to true.
- [ ] Trace contains no provider credential values.

## Claim boundaries

- [ ] Fixture smoke is not described as real provider dogfood.
- [ ] External dogfood is manual opt-in only and not run in CI.
- [ ] Best Route/direct remains production-ready best-answer routing.
- [ ] `agent_chat` remains experimental explicit opt-in only.
- [ ] No production autonomous runtime claim.
- [ ] No live Supabase Agent Bus runtime writes claim.
- [ ] No service-role runtime claim.
- [ ] Fusion Router remains Source-Available Non-Commercial / not open source.

## Release/publish follow-up

After external dogfood passes and the user explicitly approves release:

- [ ] Prepare v0.1.4 release/tag.
- [ ] Align generated runtime import with v0.1.4.
- [ ] Publish `create-fusion-router@0.1.4` only after npm auth/publish gates
      pass.
- [ ] Verify npm latest points to 0.1.4.
- [ ] Re-run NPX latest smoke and external dogfood check.
