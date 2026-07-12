# Launch-day checklist

## Verified green

- [x] GitHub repository is `sakamoto-sann/quorum-router`.
- [x] Registry-backed `npx create-quorum-router@latest` scaffold works.
- [x] Fresh generated project passes `deno task check` and `deno task smoke`.
- [x] Repository suite passes 275 tests.
- [x] Secret scans are clean.
- [x] Best Route and Agent Chat use separate videos.
- [x] Best Route shows isolated candidates followed by router synthesis.
- [x] Agent Chat shows Grok and GLM replying to each other over six rounds.
- [x] SafeLoop authority and license boundaries are documented.

## Required before public posting

- [x] Review and rename GitHub release metadata `v0.1.0`–`v0.1.4` from legacy
      branding to `QuorumRouter` with explicit approval.
- [ ] Confirm Product Hunt title, tagline, description, repository URL, license,
      and maker comment in the final listing preview.
- [ ] Attach Best Route first and Agent Chat second; do not use the removed
      combined video.
- [ ] Verify both uploaded videos play correctly after platform transcoding.
- [ ] Obtain explicit approval immediately before Product Hunt publication.
- [ ] Preview the final X thread with Best Route attached to post 2 and Agent
      Chat attached to post 3.
- [ ] Obtain explicit approval immediately before X posting.

## Hard stops

- Do not claim the deterministic videos are live model/API recordings.
- Do not claim npm availability until registry readback and clean-room NPX smoke
  both pass.
- Do not mutate dist-tags outside the approved immutable-tag release workflow.
- Do not expose provider credentials, npm tokens, passwords, OTP, signing keys,
  or approval databases.
- Do not call QuorumRouter OSI open source; it is MIT.
- Do not let a model sign policy, self-approve, or bypass SafeLoop.

## Optional real-provider dogfood

Real provider dogfood remains useful evidence but is separate from the
fixture-backed launch videos. Record provider availability, auth mode, schema
validation, redaction, and trace provenance. Do not silently substitute an
API-key env fallback for an unavailable OAuth/session wrapper.
