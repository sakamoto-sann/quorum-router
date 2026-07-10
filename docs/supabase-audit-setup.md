# Supabase audit setup

Phase 2.5 operator guide for the Phase 2 Supabase-backed workflow/access audit
boundary. This page is setup and operations documentation only; it does not
introduce a new runtime mode or installer.

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

| File                                                           | Purpose                                                                             |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `supabase/migrations/20260701130000_workflow_access_audit.sql` | Creates the table, append-only trigger, RPC, revokes, and grants.                   |
| `router.ts`                                                    | Exposes `createSupabaseAuditHandler()` and `createSupabaseAuditSink()`.             |
| `doctor.ts`                                                    | Reports Supabase audit config state and rejects service-role-like runtime env vars. |
| `.env.example`                                                 | Safe, empty runtime environment example.                                            |
| `docs/supabase-audit-checklist.md`                             | Manual verification checklist after applying the migration.                         |

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

1. Open `supabase/migrations/20260701130000_workflow_access_audit.sql` in an
   admin-only SQL runner such as the Supabase dashboard SQL editor.
2. Run the migration once against the target project.
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

## JWT and `org_id` claim requirements

Every successful audit RPC call must carry a user/session JWT that Supabase
treats as `authenticated` and that provides both:

| Requirement   | Source in DB              | Failure behavior                   |
| ------------- | ------------------------- | ---------------------------------- |
| actor id      | `auth.uid()`              | RPC rejects when null.             |
| tenant/org id | `auth.jwt() ->> 'org_id'` | RPC rejects when missing or empty. |

The client payload must **not** be trusted for identity. If a caller includes
`org_id`, `actor_id`, or `created_at` in a record payload, those fields are
ignored by the runtime handler and are not accepted as database-owned values by
the RPC contract. The database injects:

- `org_id` from `auth.jwt() ->> 'org_id'`;
- `actor_id` from `auth.uid()`;
- `created_at` from `now()`.

### Where the claim should come from

Pick one authoritative issuer for the runtime environment:

| Runtime shape                | Where to attach `org_id`                                                                                                                                        |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supabase Auth                | Add the org/tenant identifier to the user's app metadata or custom JWT claims, then verify `auth.jwt() ->> 'org_id'` resolves in SQL.                           |
| Custom JWT issuer            | Sign session JWTs with Supabase-compatible claims, including `sub` for `auth.uid()` and `org_id` for tenant routing.                                            |
| Edge gateway / agent gateway | Resolve the authenticated user and org before invoking the router, then pass the resulting user/session JWT into `createSupabaseAuditHandler({ jwtProvider })`. |

The repo does not define a global runtime env var for the JWT. Integrations
should provide it through `jwtProvider` from the active request/session context.
For a local one-off smoke script, keep any JWT process-local and ephemeral;
never commit or print it.

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

Phase 2.5 intentionally does not add:

- code behavior changes;
- migration SQL changes;
- router runtime logic changes;
- an installer;
- a routing mode switch;
- an agent-chat mode;
- new providers;
- any runtime service-role path.
