# v0.1.2 Release Checklist

## Target

- [ ] Release version: v0.1.2
- [ ] Release target commit matches final `main` HEAD from release readback
- [ ] Published `v0.1.2` tag points at that exact commit
- [ ] Existing v0.1.0 left unchanged
- [ ] Existing v0.1.1 left unchanged

## Security hardening

- [ ] Credential redaction hardening present
- [ ] AgentChat redaction hardening present
- [ ] Temp file hardening present
- [ ] `docs/security.md` exists
- [ ] README links security status page

## Developer adoption paths

- [ ] `packages/create-quorum-router` npm create package scaffold present
- [ ] generated demo does not require secrets
- [ ] generated demo documents tagged `v0.1.2` runtime import
- [ ] `install.sh` dry-run path present
- [ ] `docs/install.md` includes clone, npx, install, uninstall, security
      boundaries, and troubleshooting
- [ ] `docs/product-hunt.md` includes Product Hunt quickstart, license wording,
      and runtime boundaries
- [ ] README quickstart includes clone, npx scaffold, and tagged install helper
      dry-run

## Runtime boundary

- [ ] direct remains production-ready best-answer path
- [ ] agent_chat remains experimental explicit opt-in
- [ ] no production autonomous runtime
- [ ] no live Supabase Agent Bus runtime writes
- [ ] no Realtime subscriber
- [ ] no worker spawning
- [ ] no service-role runtime

## License

- [ ] LICENSE title is `QuorumRouter Source-Available Non-Commercial License`
- [ ] README says this is not an open source license
- [ ] No project-level “open source” description remains

## Verification

- [ ] deno task lock:check
- [ ] deno task check
- [ ] deno task lint
- [ ] deno task test
- [ ] fail-closed quorum handling covered by test output
- [ ] direct-mode timeout/cancellation behavior covered by test output
- [ ] deno task doctor
- [ ] doctor output reviewed: `ok: true`, direct ready, experimental
      AgentRuntime opt-in, expected Supabase/zcode notes only
- [ ] deno task smoke:v0.1
- [ ] offline example entrypoints covered by smoke/test output
- [ ] gitleaks range scan
- [ ] main CI green

## Release action

- [ ] final readback done
- [ ] tag command reviewed
- [ ] release notes reviewed
- [ ] publish explicitly approved
