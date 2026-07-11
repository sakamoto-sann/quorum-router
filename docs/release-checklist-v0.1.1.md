# v0.1.1 Release Checklist

## Target

- [ ] Release version: v0.1.1
- [ ] Release target commit: c6e0518824487a1d270edf8ec1ce326c330173fd
- [ ] Existing v0.1.0 left unchanged

## License

- [ ] LICENSE title is `MIT License`
- [ ] README says this is MIT-licensed open source
- [ ] Package metadata declares `MIT`
- [ ] Project-level “open source” descriptions are consistent

## Runtime

- [ ] direct remains production-ready best-answer path
- [ ] agent_chat requires explicit experimental opt-in
- [ ] AgentRuntime smoke passes
- [ ] AgentRuntime produces ready decision with 5 turns
- [ ] no live Supabase Agent Bus runtime writes
- [ ] no Realtime subscriber
- [ ] no worker spawning
- [ ] no service-role runtime

## Verification

- [ ] deno task lock:check
- [ ] deno task check
- [ ] deno task lint
- [ ] deno task test
- [ ] deno task doctor
- [ ] deno task smoke:v0.1
- [ ] gitleaks range scan
- [ ] main CI green

## Release action

- [ ] final readback done
- [ ] tag command reviewed
- [ ] release notes reviewed
- [ ] publish explicitly approved
