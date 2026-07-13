-- Harden the BYO audit RPC for both existing and fresh projects.
-- Every user owns their own Supabase project; no central database or shared
-- tenant-routing claim is used. Runtime callers remain authenticated JWT users.

create or replace function public.insert_workflow_access_audit_batch(records jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  rec jsonb;
  claim_actor_id uuid;
  workflow_id text;
  route text;
  decision text;
  metadata jsonb;
begin
  claim_actor_id := auth.uid();
  if claim_actor_id is null then
    raise exception 'missing authenticated user' using errcode = '28000';
  end if;

  if records is null or jsonb_typeof(records) <> 'array' then
    raise exception 'records must be a JSON array' using errcode = '22023';
  end if;
  if jsonb_array_length(records) < 1 or jsonb_array_length(records) > 100 then
    raise exception 'records batch size must be between 1 and 100' using errcode = '22023';
  end if;
  if pg_column_size(records) > 262144 then
    raise exception 'records payload exceeds 256 KiB' using errcode = '22023';
  end if;

  for rec in select value from jsonb_array_elements(records) as entry(value) loop
    if jsonb_typeof(rec) <> 'object' then
      raise exception 'each audit record must be an object' using errcode = '22023';
    end if;
    if exists (
      select 1 from jsonb_object_keys(rec) as key
      where key not in ('workflow_id', 'route', 'decision', 'metadata')
    ) then
      raise exception 'audit record contains unsupported fields' using errcode = '22023';
    end if;

    workflow_id := nullif(rec ->> 'workflow_id', '');
    route := nullif(rec ->> 'route', '');
    decision := nullif(rec ->> 'decision', '');
    metadata := coalesce(rec -> 'metadata', '{}'::jsonb);

    if workflow_id is null or length(workflow_id) > 256 then
      raise exception 'audit workflow_id is required and limited to 256 characters' using errcode = '22023';
    end if;
    if route is not null and length(route) > 256 then
      raise exception 'audit route exceeds 256 characters' using errcode = '22023';
    end if;
    if decision not in ('allow', 'error') then
      raise exception 'invalid route outcome decision' using errcode = '22023';
    end if;
    if jsonb_typeof(metadata) <> 'object' or pg_column_size(metadata) > 16384 then
      raise exception 'audit metadata must be an object no larger than 16 KiB' using errcode = '22023';
    end if;
    if exists (
      select 1 from jsonb_object_keys(metadata) as key
      where key not in (
        'command', 'mode', 'auth_mode', 'provider_selection_honored',
        'fallback_used', 'schema_valid'
      )
    ) then
      raise exception 'audit metadata contains unsupported fields' using errcode = '22023';
    end if;

    insert into public.workflow_access_audit (
      org_id, actor_id, actor_type, event_type, workflow_id, route,
      decision, reason, metadata, created_at
    ) values (
      claim_actor_id::text,
      claim_actor_id,
      'ai_assistant',
      'route.outcome',
      workflow_id,
      route,
      decision,
      case when decision = 'allow' then 'route completed' else 'route validation failed' end,
      metadata,
      now()
    );
  end loop;
end;
$$;

revoke all privileges on function public.insert_workflow_access_audit_batch(jsonb) from public;
revoke all privileges on function public.insert_workflow_access_audit_batch(jsonb) from anon;
revoke all privileges on function public.insert_workflow_access_audit_batch(jsonb) from authenticated;
grant execute on function public.insert_workflow_access_audit_batch(jsonb) to authenticated;
