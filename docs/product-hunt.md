# Product Hunt launch notes

External launch name: **QuorumRouter**.

## Tagline

**Fail-closed best-answer routing and approved agent execution for LLMs**

## Launch description

QuorumRouter routes prompts across model adapters, validates every response with
Zod, requires quorum before synthesis, and fails closed when the threshold is
not met. Its Agent Chat runtime adds a bounded Commander → Coder → Reviewer →
Red Team → Closeout workflow.

Coder actions are structured proposals. For repository and shell mutations, the
real injected SafeLoop client is the sole policy, approval, execution, audit,
receipt, rollback, and artifact-verification authority. QuorumRouter cannot sign
policy or approve its own action.

The real integration smoke now passes: an approved initial repo write is
executed, the reviewer objects, a second exact approval authorizes the coder
fix, re-review and red-team pass, and closeout becomes ready only after both
SafeLoop receipts verify.

QuorumRouter is **MIT** and **open source**. Commercial and production use are
permitted under the MIT License.

## Runtime boundaries

- `direct` = production-ready best-answer routing path.
- conversation-only `agent_chat` = explicit opt-in multi-role runtime.
- SafeLoop-backed `agent_chat` = verified local repository execution slice with
  signed policy and distinct approval.
- Supported actions: confined read, atomic write, exact patch, and exact-argv
  allowlisted command.
- GitHub/DB/external API/release/policy/credential actions are blocked.
- No live Supabase Agent Bus runtime writes.
- No service-role runtime.
- Product Hunt publication still requires final release review and explicit
  human approval.

## Quickstart

```bash
npx --yes create-quorum-router@latest my-quorum-router-demo
cd my-quorum-router-demo
deno task smoke
```

The generated scaffold does not silently enable mutation. A real SafeLoop
installation, signed operator policy, approval registry, confined action runner,
and explicit execution configuration are required.

## Verified Agent Chat smoke

```bash
SAFELOOP_E2E_BINARY=/absolute/path/to/safeloop \
SAFELOOP_E2E_PYTHON=/absolute/path/to/safeloop-python \
  deno test -A router_test.ts \
  --filter "real SafeLoop execute-request E2E"
```

## Maker comment draft

I built QuorumRouter because I wanted fail-closed multi-model routing and a
multi-agent workflow that cannot quietly bypass its execution authority. Best
Route validates every answer and requires quorum. Agent Chat can plan, propose a
change, execute it only through SafeLoop, accept a reviewer objection, apply a
second approved fix, re-review, red-team, and close out with verified evidence.

The important boundary is that the model never receives mutation authority.
SafeLoop checks a signed policy and an approval bound to the exact request
digest before execution, then watches the command and verifies artifacts and the
local anchor. Missing approval, timeout, nonzero exit, malformed receipt, or
verification failure halts the workflow.

QuorumRouter is MIT-licensed open source. Commercial and production use are
permitted.
