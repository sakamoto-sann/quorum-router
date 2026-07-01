create extension if not exists pgcrypto with schema extensions;

create table if not exists public.workflow_access_audit (
  id uuid primary key default extensions.gen_random_uuid(),
  org_id text not null,
  actor_id uuid not null,
  actor_type text not null default 'ai_assistant'
    check (actor_type in ('ai_assistant', 'user', 'system')),
  event_type text not null check (length(event_type) > 0),
  workflow_id text,
  route text,
  decision text not null check (decision in ('allow', 'deny', 'error')),
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.workflow_access_audit enable row level security;

revoke all privileges on table public.workflow_access_audit from public;
revoke all privileges on table public.workflow_access_audit from anon;
revoke all privileges on table public.workflow_access_audit from authenticated;

create or replace function public.prevent_workflow_access_audit_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'workflow_access_audit is append-only';
end;
$$;

revoke all privileges on function public.prevent_workflow_access_audit_mutation()
  from public;

drop trigger if exists workflow_access_audit_no_update_delete
  on public.workflow_access_audit;
create trigger workflow_access_audit_no_update_delete
before update or delete on public.workflow_access_audit
for each row
execute function public.prevent_workflow_access_audit_mutation();

create or replace function public.insert_workflow_access_audit_batch(records jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  rec jsonb;
  claim_org_id text;
  claim_actor_id uuid;
  event_type text;
  decision text;
begin
  claim_actor_id := auth.uid();
  if claim_actor_id is null then
    raise exception 'missing authenticated user'
      using errcode = '28000';
  end if;

  claim_org_id := nullif(auth.jwt() ->> 'org_id', '');
  if claim_org_id is null then
    raise exception 'missing org_id claim'
      using errcode = '28000';
  end if;

  if records is null or jsonb_typeof(records) <> 'array' then
    raise exception 'records must be a JSON array'
      using errcode = '22023';
  end if;

  for rec in select value from jsonb_array_elements(records) as entry(value) loop
    event_type := nullif(rec ->> 'event_type', '');
    decision := nullif(rec ->> 'decision', '');

    if event_type is null then
      raise exception 'audit event_type is required'
        using errcode = '22023';
    end if;

    if decision is null then
      raise exception 'audit decision is required'
        using errcode = '22023';
    end if;

    insert into public.workflow_access_audit (
      org_id,
      actor_id,
      actor_type,
      event_type,
      workflow_id,
      route,
      decision,
      reason,
      metadata,
      created_at
    ) values (
      claim_org_id,
      claim_actor_id,
      coalesce(nullif(rec ->> 'actor_type', ''), 'ai_assistant'),
      event_type,
      nullif(rec ->> 'workflow_id', ''),
      nullif(rec ->> 'route', ''),
      decision,
      nullif(rec ->> 'reason', ''),
      case
        when jsonb_typeof(rec -> 'metadata') = 'object' then rec -> 'metadata'
        else '{}'::jsonb
      end,
      now()
    );
  end loop;
end;
$$;

revoke all privileges on function public.insert_workflow_access_audit_batch(jsonb)
  from public;
revoke all privileges on function public.insert_workflow_access_audit_batch(jsonb)
  from anon;
revoke all privileges on function public.insert_workflow_access_audit_batch(jsonb)
  from authenticated;
grant execute on function public.insert_workflow_access_audit_batch(jsonb)
  to authenticated;
