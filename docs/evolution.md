# From Fusion Router to QuorumRouter

QuorumRouter is the continuation of the project originally called **Fusion
Router**. The rename reflects a broader contract: compare independent model
work, expose disagreement, fail closed when evidence is insufficient, and keep
execution authority separate from model deliberation.

## Evolution path

| Stage                     | Capability                                                                                              | Authority boundary                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Fusion Router             | Independent candidates, structured judging, and editor synthesis                                        | Chooses or synthesizes an answer; does not execute external mutations                                              |
| QuorumRouter / Best Route | Fail-closed provider routing, explicit eligibility, budgets, calibration evidence, and decision reports | Routes and reports within caller policy; does not approve actions                                                  |
| QuorumRouter / Agent Chat | Bounded conversation between distinct provider/model identities                                         | Produces discussion or structured proposals; read-only unless an execution authority is injected                   |
| QuorumRouter + SafeLoop   | Structured repository proposals submitted to a separately configured SafeLoop client                    | SafeLoop owns policy, approval, execution, and receipt production; QuorumRouter only verifies the returned receipt |

The stages are additive rather than a claim that every deployment should enable
every mode. Best Route/direct remains the default production path. Agent Chat,
grounded shadow evaluation, and execution slices are separately gated.

## Responsibility split

### QuorumRouter owns

- provider/model discovery and explicit routing policy;
- independent candidate collection, comparison, and bounded conversation;
- schema validation, budget checks, timeout/cancellation propagation, and
  failure visibility;
- advisory calibration, disagreement, and shadow-evaluation reports;
- verification that a returned SafeLoop receipt is structurally valid and bound
  to the exact requested digest.

### SafeLoop owns

- mutation policy and approval requirements;
- actor separation and digest-bound authorization;
- repository or shell execution within its configured authority;
- execution receipts and artifact evidence.

### Neither component implies

- that a model can approve its own proposal;
- that a route result is permission to mutate an external system;
- that an advisory score is ground truth;
- that a successful model response proves an external action happened.

## Trust-boundary flow

```text
user task
  → QuorumRouter routing / discussion
  → structured proposal
  → SafeLoop policy + approval boundary
  → bounded execution
  → digest-bound SafeLoop receipt
  → QuorumRouter receipt verification
```

If SafeLoop is absent, disabled, rejects the request, or returns an invalid
receipt, QuorumRouter has no fallback execution authority. It must remain
read-only or fail closed.

## Related documents

- [README](../README.md)
- [Japanese README](../README.ja.md)
- [AgentRuntime and SafeLoop setup](agent-runtime.md)
- [Decision reports](decision-reports.md)
- [Calibration truth boundary](calibration.md)
- [Security boundaries](security.md)
