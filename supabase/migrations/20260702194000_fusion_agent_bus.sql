-- Fusion Agent Bus durable coordination schema.
-- Runtime clients use anon/session JWT credentials; privileged runtime keys are intentionally not part of this contract.

create table if not exists public.fusion_agent_teams (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null default auth.uid(),
  name text not null check (length(btrim(name)) > 0),
  created_at timestamptz not null default now(),
  unique (owner_user_id, name)
);

create table if not exists public.fusion_agent_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.fusion_agent_teams(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('owner','operator','viewer')),
  created_at timestamptz not null default now(),
  unique (team_id, user_id)
);

create table if not exists public.fusion_agent_identities (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.fusion_agent_teams(id) on delete cascade,
  agent_name text not null check (length(btrim(agent_name)) > 0),
  agent_role text not null check (length(btrim(agent_role)) > 0),
  provider text,
  model text,
  runtime_type text not null default 'manual',
  status text not null default 'idle' check (status in ('idle','active','blocked','offline')),
  claimed_by_user_id uuid,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  unique (team_id, agent_name)
);

create table if not exists public.fusion_agent_runs (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.fusion_agent_teams(id) on delete cascade,
  commander_agent_id uuid references public.fusion_agent_identities(id),
  routing_mode text not null default 'direct',
  status text not null default 'pending' check (status in ('pending','running','blocked','completed','failed_closed')),
  budget_limit_usd numeric,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.fusion_agent_messages (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.fusion_agent_teams(id) on delete cascade,
  run_id uuid references public.fusion_agent_runs(id) on delete set null,
  from_agent_id uuid references public.fusion_agent_identities(id) on delete set null,
  to_agent_id uuid references public.fusion_agent_identities(id) on delete set null,
  message_type text not null default 'text' check (message_type in ('text','task','result','objection','closeout','directive')),
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  read_at timestamptz
);

create table if not exists public.fusion_agent_events (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.fusion_agent_teams(id) on delete cascade,
  run_id uuid references public.fusion_agent_runs(id) on delete set null,
  agent_id uuid references public.fusion_agent_identities(id) on delete set null,
  event_type text not null check (length(btrim(event_type)) > 0),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists fusion_agent_members_team_user_idx
  on public.fusion_agent_members(team_id, user_id);
create index if not exists fusion_agent_identities_team_name_idx
  on public.fusion_agent_identities(team_id, agent_name);
create index if not exists fusion_agent_runs_team_status_started_idx
  on public.fusion_agent_runs(team_id, status, started_at desc);
create index if not exists fusion_agent_messages_team_run_created_idx
  on public.fusion_agent_messages(team_id, run_id, created_at desc);
create index if not exists fusion_agent_messages_team_inbox_idx
  on public.fusion_agent_messages(team_id, to_agent_id, read_at, created_at desc);
create index if not exists fusion_agent_events_team_run_created_idx
  on public.fusion_agent_events(team_id, run_id, created_at desc);
create index if not exists fusion_agent_events_team_type_created_idx
  on public.fusion_agent_events(team_id, event_type, created_at desc);

alter table public.fusion_agent_teams enable row level security;
alter table public.fusion_agent_members enable row level security;
alter table public.fusion_agent_identities enable row level security;
alter table public.fusion_agent_runs enable row level security;
alter table public.fusion_agent_messages enable row level security;
alter table public.fusion_agent_events enable row level security;

-- Runtime access is through validated RPCs only. Revoke table endpoint
-- privileges so RLS remains defense-in-depth instead of the primary write path.
revoke all privileges on table public.fusion_agent_teams from public, anon, authenticated;
revoke all privileges on table public.fusion_agent_members from public, anon, authenticated;
revoke all privileges on table public.fusion_agent_identities from public, anon, authenticated;
revoke all privileges on table public.fusion_agent_runs from public, anon, authenticated;
revoke all privileges on table public.fusion_agent_messages from public, anon, authenticated;
revoke all privileges on table public.fusion_agent_events from public, anon, authenticated;

create or replace function public.fusion_agent_is_team_member(team uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.fusion_agent_teams t
    where t.id = team
      and t.owner_user_id = auth.uid()
  )
  or exists (
    select 1
    from public.fusion_agent_members m
    where m.team_id = team
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.fusion_agent_is_team_operator(team uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.fusion_agent_teams t
    where t.id = team
      and t.owner_user_id = auth.uid()
  )
  or exists (
    select 1
    from public.fusion_agent_members m
    where m.team_id = team
      and m.user_id = auth.uid()
      and m.role in ('owner','operator')
  );
$$;

create or replace function public.fusion_agent_is_team_owner(team uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.fusion_agent_teams t
    where t.id = team
      and t.owner_user_id = auth.uid()
  )
  or exists (
    select 1
    from public.fusion_agent_members m
    where m.team_id = team
      and m.user_id = auth.uid()
      and m.role = 'owner'
  );
$$;

create or replace function public.fusion_agent_identity_in_team(identity uuid, team uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select identity is null
  or exists (
    select 1
    from public.fusion_agent_identities i
    where i.id = identity
      and i.team_id = team
  );
$$;

create or replace function public.fusion_agent_run_in_team(run uuid, team uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select run is null
  or exists (
    select 1
    from public.fusion_agent_runs r
    where r.id = run
      and r.team_id = team
  );
$$;

drop policy if exists fusion_agent_teams_read on public.fusion_agent_teams;
create policy fusion_agent_teams_read
on public.fusion_agent_teams
for select
to authenticated
using (public.fusion_agent_is_team_member(id));

drop policy if exists fusion_agent_teams_insert on public.fusion_agent_teams;
create policy fusion_agent_teams_insert
on public.fusion_agent_teams
for insert
to authenticated
with check (owner_user_id = auth.uid());

drop policy if exists fusion_agent_teams_owner_update on public.fusion_agent_teams;
create policy fusion_agent_teams_owner_update
on public.fusion_agent_teams
for update
to authenticated
using (public.fusion_agent_is_team_owner(id))
with check (public.fusion_agent_is_team_owner(id));

drop policy if exists fusion_agent_members_read on public.fusion_agent_members;
create policy fusion_agent_members_read
on public.fusion_agent_members
for select
to authenticated
using (public.fusion_agent_is_team_member(team_id));

drop policy if exists fusion_agent_members_owner_insert on public.fusion_agent_members;
create policy fusion_agent_members_owner_insert
on public.fusion_agent_members
for insert
to authenticated
with check (public.fusion_agent_is_team_owner(team_id));

drop policy if exists fusion_agent_members_owner_update on public.fusion_agent_members;
create policy fusion_agent_members_owner_update
on public.fusion_agent_members
for update
to authenticated
using (public.fusion_agent_is_team_owner(team_id))
with check (public.fusion_agent_is_team_owner(team_id));

drop policy if exists fusion_agent_members_owner_delete on public.fusion_agent_members;
create policy fusion_agent_members_owner_delete
on public.fusion_agent_members
for delete
to authenticated
using (public.fusion_agent_is_team_owner(team_id));

drop policy if exists fusion_agent_identities_read on public.fusion_agent_identities;
create policy fusion_agent_identities_read
on public.fusion_agent_identities
for select
to authenticated
using (public.fusion_agent_is_team_member(team_id));

drop policy if exists fusion_agent_identities_operator_insert on public.fusion_agent_identities;
create policy fusion_agent_identities_operator_insert
on public.fusion_agent_identities
for insert
to authenticated
with check (public.fusion_agent_is_team_operator(team_id));

drop policy if exists fusion_agent_identities_operator_update on public.fusion_agent_identities;
create policy fusion_agent_identities_operator_update
on public.fusion_agent_identities
for update
to authenticated
using (public.fusion_agent_is_team_operator(team_id))
with check (public.fusion_agent_is_team_operator(team_id));

drop policy if exists fusion_agent_runs_read on public.fusion_agent_runs;
create policy fusion_agent_runs_read
on public.fusion_agent_runs
for select
to authenticated
using (public.fusion_agent_is_team_member(team_id));

drop policy if exists fusion_agent_runs_operator_insert on public.fusion_agent_runs;
create policy fusion_agent_runs_operator_insert
on public.fusion_agent_runs
for insert
to authenticated
with check (
  public.fusion_agent_is_team_operator(team_id)
  and public.fusion_agent_identity_in_team(commander_agent_id, team_id)
);

drop policy if exists fusion_agent_runs_operator_update on public.fusion_agent_runs;
create policy fusion_agent_runs_operator_update
on public.fusion_agent_runs
for update
to authenticated
using (public.fusion_agent_is_team_operator(team_id))
with check (
  public.fusion_agent_is_team_operator(team_id)
  and public.fusion_agent_identity_in_team(commander_agent_id, team_id)
);

drop policy if exists fusion_agent_messages_read on public.fusion_agent_messages;
create policy fusion_agent_messages_read
on public.fusion_agent_messages
for select
to authenticated
using (public.fusion_agent_is_team_member(team_id));

drop policy if exists fusion_agent_messages_operator_insert on public.fusion_agent_messages;
create policy fusion_agent_messages_operator_insert
on public.fusion_agent_messages
for insert
to authenticated
with check (
  public.fusion_agent_is_team_operator(team_id)
  and from_agent_id is not null
  and public.fusion_agent_run_in_team(run_id, team_id)
  and public.fusion_agent_identity_in_team(from_agent_id, team_id)
  and public.fusion_agent_identity_in_team(to_agent_id, team_id)
);

drop policy if exists fusion_agent_messages_member_update_read on public.fusion_agent_messages;

drop policy if exists fusion_agent_events_read on public.fusion_agent_events;
create policy fusion_agent_events_read
on public.fusion_agent_events
for select
to authenticated
using (public.fusion_agent_is_team_member(team_id));

drop policy if exists fusion_agent_events_operator_insert on public.fusion_agent_events;
create policy fusion_agent_events_operator_insert
on public.fusion_agent_events
for insert
to authenticated
with check (
  public.fusion_agent_is_team_operator(team_id)
  and public.fusion_agent_run_in_team(run_id, team_id)
  and public.fusion_agent_identity_in_team(agent_id, team_id)
);

create or replace function public.fusion_agent_send_message(
  p_team_id uuid,
  p_run_id uuid,
  p_from_agent_id uuid,
  p_to_agent_id uuid,
  p_message_type text,
  p_body text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_message_id uuid;
  v_message_type text := coalesce(p_message_type, 'text');
begin
  if not public.fusion_agent_is_team_operator(p_team_id) then
    raise exception 'agent bus team access denied' using errcode = '42501';
  end if;
  if p_from_agent_id is null then
    raise exception 'agent bus sender required' using errcode = '23514';
  end if;
  if not public.fusion_agent_run_in_team(p_run_id, p_team_id) then
    raise exception 'agent bus run relation invalid' using errcode = '23514';
  end if;
  if not public.fusion_agent_identity_in_team(p_from_agent_id, p_team_id) then
    raise exception 'agent bus sender relation invalid' using errcode = '23514';
  end if;
  if not public.fusion_agent_identity_in_team(p_to_agent_id, p_team_id) then
    raise exception 'agent bus recipient relation invalid' using errcode = '23514';
  end if;
  if v_message_type not in ('text','task','result','objection','closeout','directive') then
    raise exception 'agent bus message type invalid' using errcode = '23514';
  end if;
  if p_body is null or length(p_body) = 0 then
    raise exception 'agent bus message body required' using errcode = '23514';
  end if;

  insert into public.fusion_agent_messages(
    team_id, run_id, from_agent_id, to_agent_id, message_type, body, metadata
  ) values (
    p_team_id, p_run_id, p_from_agent_id, p_to_agent_id, v_message_type, p_body, coalesce(p_metadata, '{}'::jsonb)
  ) returning id into v_message_id;

  return v_message_id;
end;
$$;

create or replace function public.fusion_agent_mark_message_read(
  p_message_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
begin
  select team_id into v_team_id
  from public.fusion_agent_messages
  where id = p_message_id;

  if v_team_id is null or not public.fusion_agent_is_team_member(v_team_id) then
    return false;
  end if;

  update public.fusion_agent_messages
  set read_at = coalesce(read_at, now())
  where id = p_message_id;

  return found;
end;
$$;

create or replace function public.fusion_agent_unread_messages(
  p_team_id uuid,
  p_agent_id uuid,
  p_limit integer default 50
)
returns setof public.fusion_agent_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
begin
  if not public.fusion_agent_is_team_member(p_team_id) then
    raise exception 'agent bus team access denied' using errcode = '42501';
  end if;
  if not public.fusion_agent_identity_in_team(p_agent_id, p_team_id) then
    raise exception 'agent bus inbox relation invalid' using errcode = '23514';
  end if;

  return query
  select *
  from public.fusion_agent_messages
  where team_id = p_team_id
    and to_agent_id = p_agent_id
    and read_at is null
  order by created_at asc, id asc
  limit v_limit;
end;
$$;

create or replace function public.fusion_agent_history(
  p_team_id uuid,
  p_run_id uuid,
  p_limit integer default 100
)
returns setof public.fusion_agent_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 500);
begin
  if not public.fusion_agent_is_team_member(p_team_id) then
    raise exception 'agent bus team access denied' using errcode = '42501';
  end if;
  if not public.fusion_agent_run_in_team(p_run_id, p_team_id) then
    raise exception 'agent bus run relation invalid' using errcode = '23514';
  end if;

  return query
  select *
  from public.fusion_agent_messages
  where team_id = p_team_id
    and (p_run_id is null or run_id = p_run_id)
  order by created_at asc, id asc
  limit v_limit;
end;
$$;

create or replace function public.fusion_agent_record_event(
  p_team_id uuid,
  p_run_id uuid,
  p_agent_id uuid,
  p_event_type text,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
begin
  if not public.fusion_agent_is_team_operator(p_team_id) then
    raise exception 'agent bus team access denied' using errcode = '42501';
  end if;
  if not public.fusion_agent_run_in_team(p_run_id, p_team_id) then
    raise exception 'agent bus run relation invalid' using errcode = '23514';
  end if;
  if not public.fusion_agent_identity_in_team(p_agent_id, p_team_id) then
    raise exception 'agent bus event relation invalid' using errcode = '23514';
  end if;
  if p_event_type is null or length(btrim(p_event_type)) = 0 then
    raise exception 'agent bus event type required' using errcode = '23514';
  end if;

  insert into public.fusion_agent_events(team_id, run_id, agent_id, event_type, payload)
  values (p_team_id, p_run_id, p_agent_id, p_event_type, coalesce(p_payload, '{}'::jsonb))
  returning id into v_event_id;

  return v_event_id;
end;
$$;

revoke execute on function public.fusion_agent_send_message(uuid, uuid, uuid, uuid, text, text, jsonb) from public, anon;
revoke execute on function public.fusion_agent_mark_message_read(uuid) from public, anon;
revoke execute on function public.fusion_agent_unread_messages(uuid, uuid, integer) from public, anon;
revoke execute on function public.fusion_agent_history(uuid, uuid, integer) from public, anon;
revoke execute on function public.fusion_agent_record_event(uuid, uuid, uuid, text, jsonb) from public, anon;

grant execute on function public.fusion_agent_send_message(uuid, uuid, uuid, uuid, text, text, jsonb) to authenticated;
grant execute on function public.fusion_agent_mark_message_read(uuid) to authenticated;
grant execute on function public.fusion_agent_unread_messages(uuid, uuid, integer) to authenticated;
grant execute on function public.fusion_agent_history(uuid, uuid, integer) to authenticated;
grant execute on function public.fusion_agent_record_event(uuid, uuid, uuid, text, jsonb) to authenticated;
