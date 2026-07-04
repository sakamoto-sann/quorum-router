# Dogfood bug report template

## Summary

One sentence describing the failure and why it matters.

## Severity

Choose one:

- [ ] P0 launch blocker
- [ ] P1 must fix before public posting
- [ ] P2 should fix
- [ ] P3 polish

## Environment

- Tester:
- OS:
- Shell:
- Node version:
- npm version:
- Deno version:
- Repo commit or npm version:
- Date/time:

## Mode affected

Choose all that apply:

- [ ] NPX
- [ ] Best Route
- [ ] Agent Chat
- [ ] README
- [ ] GitHub release
- [ ] npm
- [ ] docs/copy

## Safety/claims affected

- [ ] Yes
- [ ] No

If yes, describe the unsafe or false claim:

## Steps to reproduce

1.
2.
3.

## Expected result

What should have happened?

## Actual result

What happened instead?

## Logs

```text
Paste relevant logs here. Redact credentials. Do not paste npm tokens, passwords, OTPs, or private keys.
```

## Screenshots/GIF

Attach or link if useful.

## Suggested fix

Describe the smallest change that would resolve or mitigate the issue.

## Launch decision

Choose one:

- [ ] block
- [ ] allow with known limitation
- [ ] non-blocking

## Owner / follow-up

- Owner:
- Follow-up issue/PR:
- Retest result:
