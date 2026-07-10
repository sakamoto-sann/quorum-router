# Supabase audit manual verification checklist

Run this after applying
`supabase/migrations/20260701130000_workflow_access_audit.sql` to a target
Supabase project.

Use an admin/operator SQL surface for schema inspection. Use a normal
user/session JWT for RPC-path tests. Do not install service-role credentials
into the router runtime.

## Migration and schema

- [ ] Migration applied successfully.
- [ ] Table exists:

  ```sql
  select to_regclass('public.workflow_access_audit') as audit_table;
  ```

  Expected: `public.workflow_access_audit`.

- [ ] RLS is enabled:

  ```sql
  select relrowsecurity
  from pg_class
  where oid = 'public.workflow_access_audit'::regclass;
  ```

  Expected: `true`.

- [ ] RPC exists:

  ```sql
  select to_regprocedure('public.insert_workflow_access_audit_batch(jsonb)')
    as audit_rpc;
  ```

  Expected: `insert_workflow_access_audit_batch(jsonb)`.

## Privilege boundary

- [ ] `anon` has no direct table access:

  ```sql
  select
    has_table_privilege('anon', 'public.workflow_access_audit', 'SELECT') as anon_select,
    has_table_privilege('anon', 'public.workflow_access_audit', 'INSERT') as anon_insert,
    has_table_privilege('anon', 'public.workflow_access_audit', 'UPDATE') as anon_update,
    has_table_privilege('anon', 'public.workflow_access_audit', 'DELETE') as anon_delete;
  ```

  Expected: all `false`.

- [ ] `authenticated` has no direct table access:

  ```sql
  select
    has_table_privilege('authenticated', 'public.workflow_access_audit', 'SELECT') as auth_select,
    has_table_privilege('authenticated', 'public.workflow_access_audit', 'INSERT') as auth_insert,
    has_table_privilege('authenticated', 'public.workflow_access_audit', 'UPDATE') as auth_update,
    has_table_privilege('authenticated', 'public.workflow_access_audit', 'DELETE') as auth_delete;
  ```

  Expected: all `false`.

- [ ] `anon` cannot execute the RPC:

  ```sql
  select has_function_privilege(
    'anon',
    'public.insert_workflow_access_audit_batch(jsonb)',
    'EXECUTE'
  ) as anon_rpc_execute;
  ```

  Expected: `false`.

- [ ] `authenticated` can execute only the RPC boundary:

  ```sql
  select has_function_privilege(
    'authenticated',
    'public.insert_workflow_access_audit_batch(jsonb)',
    'EXECUTE'
  ) as auth_rpc_execute;
  ```

  Expected: `true`.

## Runtime rejection checks

Use a non-production project or disposable test records for these calls.

- [ ] RPC rejects missing auth / missing `auth.uid()`.

  Example shape with no bearer token:

  ```bash
  curl -sS -X POST \
    "https://<project-ref>.supabase.co/rest/v1/rpc/insert_workflow_access_audit_batch" \
    -H "apikey: ${QUORUM_ROUTER_SUPABASE_ANON_KEY}" \
    -H "content-type: application/json" \
    -d '{"records":[{"event_type":"verification.missing-auth","decision":"allow"}]}'
  ```

  Expected: rejected. Common outcomes:

  - permission error before the SQL body runs;
  - RPC error text: `missing authenticated user`.

- [ ] RPC rejects an authenticated JWT with missing or empty `org_id` claim.

  Use a real test user/session JWT that resolves `auth.uid()` but has no usable
  `org_id` claim. Call the same RPC with that bearer token:

  ```bash
  curl -sS -X POST \
    "https://<project-ref>.supabase.co/rest/v1/rpc/insert_workflow_access_audit_batch" \
    -H "apikey: ${QUORUM_ROUTER_SUPABASE_ANON_KEY}" \
    -H "authorization: Bearer ${TEST_USER_SESSION_JWT_WITHOUT_ORG}" \
    -H "content-type: application/json" \
    -d '{"records":[{"event_type":"verification.missing-org","decision":"allow"}]}'
  ```

  Expected: rejected with `missing org_id claim` or an equivalent auth error.

## DB-owned field checks

- [ ] RPC inserts DB-owned `org_id`, `actor_id`, and `created_at`.

  With a valid test user/session JWT that includes `org_id`, call the RPC with a
  payload that tries to spoof those fields:

  ```json
  {
    "records": [
      {
        "event_type": "verification.db-owned-fields",
        "decision": "allow",
        "org_id": "spoofed-client-org",
        "actor_id": "00000000-0000-0000-0000-000000000000",
        "created_at": "2000-01-01T00:00:00.000Z",
        "metadata": { "verification": true }
      }
    ]
  }
  ```

  Then inspect the inserted row through an admin/operator SQL surface:

  ```sql
  select org_id, actor_id, created_at, event_type, decision, metadata
  from public.workflow_access_audit
  where event_type = 'verification.db-owned-fields'
  order by created_at desc
  limit 1;
  ```

  Expected:

  - `org_id` equals the JWT `org_id` claim, not `spoofed-client-org`;
  - `actor_id` equals `auth.uid()`, not the spoofed all-zero UUID;
  - `created_at` is the database insertion time, not year 2000;
  - event fields such as `event_type`, `decision`, and object `metadata` are
    preserved.

## Append-only checks

- [ ] `UPDATE` fails with append-only error:

  ```sql
  update public.workflow_access_audit
  set reason = 'should fail'
  where event_type = 'verification.db-owned-fields';
  ```

  Expected: `workflow_access_audit is append-only`.

- [ ] `DELETE` fails with append-only error:

  ```sql
  delete from public.workflow_access_audit
  where event_type = 'verification.db-owned-fields';
  ```

  Expected: `workflow_access_audit is append-only`.

## Doctor and runtime environment checks

- [ ] Fully unset Supabase audit config is informational for local evaluation
      hosts:

  ```bash
  deno task doctor
  ```

  Expected: `supabase_audit_config` is `not configured`, severity `info`, if
  both Supabase URL and anon key are absent.

- [ ] Partial Supabase audit config warns.

  Run doctor in a throwaway shell with only the URL or only the anon key set.
  Expected: `supabase_audit_config` severity `warn` with incomplete config
  detail.

- [ ] Runtime doctor fails if a Supabase service-role-like env var exists.

  Run doctor in a throwaway shell containing a synthetic service-role-like
  Supabase env var. Expected: non-zero exit and `supabase_service_role_absent`
  failure.

- [ ] Runtime doctor does not print credential values.

  Use synthetic throwaway values only. Expected: doctor output may include the
  env var name, but not the value.

- [ ] `cli_zcode` warning is optional.

  Expected: `cli_zcode` may report `not found`, severity `warn`, on hosts that
  do not run the GLM/ZCode lane.

## Closeout evidence to capture

Record these in the deployment/change ticket, not in a public PR comment if they
include project identifiers or non-public tenant names:

- migration timestamp and project ref;
- schema/RLS privilege query results;
- RPC rejection results for missing auth and missing `org_id`;
- DB-owned field verification row, with sensitive org/user identifiers redacted;
- append-only update/delete failure evidence;
- `deno task doctor` result from the runtime host.
