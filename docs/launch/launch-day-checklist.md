# Launch-day checklist

## Verified green

- [x] GitHub repository is `sakamoto-sann/quorum-router`.
- [x] Source-backed `npx github:sakamoto-sann/quorum-router#main` scaffold
      works.
- [x] Fresh generated project passes `deno task check` and `deno task smoke`.
- [x] Repository suite passes 258 tests.
- [x] Secret scans are clean.
- [x] Best Route and Agent Chat use separate videos.
- [x] Best Route shows isolated candidates followed by router synthesis.
- [x] Agent Chat shows Grok and GLM replying to each other over six rounds.
- [x] SafeLoop authority and license boundaries are documented.

## Required before public posting

- [ ] Review and rename the latest GitHub release metadata from legacy
      `Fusion Router` branding to `QuorumRouter` with explicit approval.
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
- Do not claim `create-quorum-router` is published on npm; registry readback is
  currently `E404`.
- Do not publish npm, mutate dist-tags, or run the publish workflow without
  explicit approval.
- Do not expose provider credentials, npm tokens, passwords, OTP, signing keys,
  or approval databases.
- Do not call QuorumRouter OSI open source; it is Source-Available
  Non-Commercial.
- Do not let a model sign policy, self-approve, or bypass SafeLoop.

## Optional real-provider dogfood

Real provider dogfood remains useful evidence but is separate from the
fixture-backed launch videos. Record provider availability, auth mode, schema
validation, redaction, and trace provenance. Do not silently substitute an
API-key env fallback for an unavailable OAuth/session wrapper.
