# Supabase audit setup

Operator guide for the optional user-owned Supabase workflow/access audit
boundary. The root runtime remains fail-closed. Generated `create-quorum-router`
projects add selective `disabled`, `optional`, and `required` modes for
tomorrow's audit-only MVP.

## What this audit log is for

`workflow_access_audit` is the durable audit log for workflow/access decisions
made by the quorum router and adjacent agent workflows. It is intentionally
different from best-effort telemetry:

- telemetry may drop old entries to keep the request path healthy;
- access audit records are **must-accept / fail-closed**;
- audit rows are append-only;
- runtime code must not carry a Supabase service-role credential;
- the database, not the client, owns the durable tenant and actor fields.

The runtime transport posts batches to:

```text
/rest/v1/rpc/insert_workflow_access_audit_batch
```

That RPC inserts into `public.workflow_access_audit` after deriving identity
from the authenticated request.

## Files in this repo

| File                                                                                                                | Purpose                                                                              |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `supabase/migrations/20260701130000_workflow_access_audit.sql`                                                      | Creates the table, append-only trigger, RPC, revokes, and grants.                    |
| `supabase/migrations/20260712211500_workflow_access_audit_limits.sql`                                               | Narrows the route-outcome RPC and adds payload limits for existing/fresh projects.   |
| `router.ts`                                                                                                         | Exposes `createSupabaseAuditHandler()` and `createSupabaseAuditSink()`.              |
| `doctor.ts`                                                                                                         | Reports Supabase audit config state and rejects service-role-like runtime env vars.  |
| `.env.example`                                                                                                      | Safe, empty runtime environment example.                                             |
| `docs/supabase-audit-checklist.md`                                                                                  | Manual verification checklist after applying the migration.                          |
| `packages/create-quorum-router/templates/basic/supabase/migrations/20260701130000_workflow_access_audit.sql`        | Migration bundled into each generated project.                                       |
| `packages/create-quorum-router/templates/basic/supabase/migrations/20260712211500_workflow_access_audit_limits.sql` | Required hardening migration bundled into each generated project.                    |
| `packages/create-quorum-router/templates/basic/src/supabase.ts`                                                     | Generated-project status, credential boundary, RPC client, and selective route hook. |

## Migration apply

Use one of these apply paths. In both cases, use an admin/operator context for
the migration step only. Do **not** install a service-role key into the router
runtime.

### Option A: Supabase CLI

1. Authenticate the Supabase CLI using your normal secret-manager workflow. Do
   not paste access tokens into chat, commits, shell history, or PR text.
2. Link the project:

   ```bash
   supabase link --project-ref <project-ref>
   ```

3. Apply checked-in migrations:

   ```bash
   supabase db push
   ```

4. Run the manual checks in
   [`supabase-audit-checklist.md`](./supabase-audit-checklist.md).

### Option B: SQL editor / admin SQL runner

1. Open both files under `supabase/migrations/` in filename order in an
   admin-only SQL runner such as the Supabase dashboard SQL editor.
2. Run both migrations against the target project. The later limits migration is
   mandatory, including for projects that applied the first migration earlier.
3. Run the manual checks in
   [`supabase-audit-checklist.md`](./supabase-audit-checklist.md).

## Privilege model

The migration establishes this privilege boundary:

| Principal                |                                              Table access |                                                    RPC access | Notes                                                                      |
| ------------------------ | --------------------------------------------------------: | ------------------------------------------------------------: | -------------------------------------------------------------------------- |
| `anon`                   |                                                      none |                                                          none | Anonymous callers cannot write or call the audit RPC.                      |
| `authenticated`          | no direct table `SELECT`, `INSERT`, `UPDATE`, or `DELETE` | `EXECUTE` on `insert_workflow_access_audit_batch(jsonb)` only | Runtime callers write through the RPC boundary.                            |
| migration/admin operator |                                       migration-time only |                                           migration-time only | Use only for applying or inspecting schema. Not a runtime credential path. |

The table has RLS enabled and direct table privileges are revoked from `public`,
`anon`, and `authenticated`. The RPC is `security definer`, has
`set search_path = public, pg_temp`, and is granted only to `authenticated`.

The table is append-only. Any `UPDATE` or `DELETE` attempt raises:

```text
workflow_access_audit is append-only
```

## JWT identity requirements

Every successful audit RPC call must carry a user/session JWT that Supabase
treats as `authenticated`:

| Requirement     | Source in DB       | Failure behavior                                          |
| --------------- | ------------------ | --------------------------------------------------------- |
| actor id        | `auth.uid()`       | RPC rejects when null.                                    |
| audit namespace | `auth.uid()::text` | Derived by the database; no client org claim is accepted. |

The client payload must **not** be trusted for identity. If a caller includes
`org_id`, `actor_id`, or `created_at` in a record payload, those fields are
ignored by the runtime handler and are not accepted as database-owned values by
the RPC contract. The database injects:

- `org_id` from `auth.uid()::text` for this single-user BYO project boundary;
- `actor_id` from `auth.uid()`;
- `created_at` from `now()`.

This MVP intentionally has no central or shared database and no multi-org tenant
claim. Each user connects their own Supabase project. If a future project needs
multiple organizations, it must add a database-owned membership table and a
separately reviewed RPC rather than trusting a client JWT `org_id`.

The root library receives the JWT through `jwtProvider`. The generated CLI uses
`QUORUM_ROUTER_SUPABASE_SESSION_JWT` (or `SUPABASE_SESSION_JWT`) for its active
process only. Keep it ephemeral; never commit or print it.

## Runtime environment example

Prefer project-specific names when wiring the router. `doctor.ts` also
recognizes the non-prefixed Supabase names as fallbacks.

```dotenv
# Supabase audit RPC endpoint. Use your project URL, for example
# https://<project-ref>.supabase.co
QUORUM_ROUTER_SUPABASE_URL=

# Supabase project anon key. Keep empty in examples; inject at runtime from a
# secret manager or deployment environment.
QUORUM_ROUTER_SUPABASE_ANON_KEY=

# Optional fallback names if your runtime already standardizes on SUPABASE_*.
SUPABASE_URL=
SUPABASE_ANON_KEY=

# Generated CLI only: active user/session JWT, never a service-role token.
QUORUM_ROUTER_SUPABASE_SESSION_JWT=
```

The user/session JWT is not shown as a checked-in env value. Pass it from the
request/session boundary:

```ts
const auditHandler = createSupabaseAuditHandler({
  supabaseUrl,
  anonKeyProvider: () => anonCredential,
  jwtProvider: () => sessionJwt,
});
```

Do not add `SUPABASE_SERVICE_ROLE_KEY` or any service-role-like Supabase
variable to the router runtime environment. Service-role credentials are only
for out-of-band migration/admin operations.

## Generated project selective mode

Supabase is absent by default. Copy `router.config.example.json` to
`router.config.json` only when you need local configuration, then keep the
feature shape strict and non-secret:

```json
{
  "features": {
    "supabase": {
      "audit": { "mode": "optional" }
    }
  }
}
```

- `disabled`: default; no audit fetch is attempted.
- `optional`: route succeeds and prints an explicit warning if audit fails.
- `required`: audit failure withholds the route result and exits nonzero.

Run `deno task supabase:status` before routing. It performs no network request,
prints no credential values, exits 0 for disabled or fully configured state, and
exits 1 for partial or forbidden credentials.

## Doctor output

Run:

```bash
deno task doctor
```

Supabase-related checks mean:

| Check                                                        | Meaning                                                                                                                          | Operator action                                                                              |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `supabase_audit_config`, `not configured`, severity `info`   | Neither URL nor anon key is set. This is acceptable for local local evaluation runs that do not enable Supabase audit transport. | No action unless this host should emit audit records.                                        |
| `supabase_audit_config`, partial config, severity `warn`     | Only URL or anon key is set. The RPC transport would be incomplete.                                                              | Configure both values or remove the partial config.                                          |
| `supabase_service_role_absent`, severity `error` when failed | A service-role-like Supabase env var is present in runtime.                                                                      | Remove it from runtime. Keep service-role/admin credentials only in migration/admin tooling. |
| `cli_zcode`, `not found`, severity `warn`                    | Optional GLM/ZCode lane is unavailable on this host.                                                                             | Install/configure ZCode only on hosts expected to run that lane.                             |

Doctor must never print credential values. If a Supabase service-role-like env
var is present, doctor reports the variable name and redacts the value.

## Runtime payload shape

The runtime handler sends only event fields:

```json
{
  "records": [
    {
      "event_type": "workflow.access",
      "actor_type": "ai_assistant",
      "workflow_id": "workflow-id",
      "route": "route-name",
      "decision": "allow",
      "reason": "short reason",
      "metadata": {}
    }
  ]
}
```

It does not send `org_id`, `actor_id`, or `created_at`. Those are owned by the
DB.

## Non-goals

The tomorrow MVP intentionally does not add:

- Supabase project/account creation or migration application;
- an operator-owned central Supabase project;
- Agent Bus or Realtime wakeups;
- state sync or an analytics dashboard;
- new providers or routing modes;
- any runtime service-role/admin path.
