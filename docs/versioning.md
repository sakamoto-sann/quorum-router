# Versioning and public release policy

QuorumRouter is a public MIT-licensed product. Version numbers identify shipped
technical artifacts; they are not labels for product incompleteness.

## Current public artifacts

- GitHub Release line: `v0.1.14`
- npm package: `create-quorum-router@0.1.14`
- npm `latest`: `0.1.14`

Public quickstart:

```bash
npx --yes create-quorum-router@latest my-quorum-router
cd my-quorum-router
deno task smoke
```

## Version discipline

- Use SemVer for every immutable GitHub and npm artifact.
- Publish fixes as a new version; never rewrite an npm tarball or move a tag.
- Keep the source installer default, package manifests, release notes, GitHub
  Release, npm `latest`, and generated scaffold on the same release version.
- Historical release notes may retain the version they documented, but any
  registry value described as current must be labeled with its original date.

## Runtime status language

- Direct mode is the production fail-closed routing path.
- AgentRuntime is production-capable when configured with a real SafeLoop
  execution authority and bounded operator approval flow.
- Conversation-only Agent Chat without execution authority remains explicit
  opt-in and is not production execution.
- Calibration reports are externally grounded diagnostics; they must not be
  presented as automatic routing authority unless an explicit, tested policy is
  added.
- QuorumRouter does not provide a hosted central runtime or service-role data
  plane.
