-- PrimeHub Social AI private owner-controlled Android agent (navigation only).
-- Isolated from PrimeHubMall customer/shop tables, denies direct table access via RLS.
create table if not exists public.ph_social_agent_sessions (
  device_id uuid primary key references public.ph_social_pairing_devices(device_id) on delete cascade,
  access_hash text not null unique,
  expires_at timestamptz not null,
  opened_at timestamptz not null default now(),
  last_seen timestamptz,
  revision integer not null default 0,
  snapshot jsonb
);
alter table public.ph_social_agent_sessions enable row level security;
revoke all on public.ph_social_agent_sessions from public, anon, authenticated;
create table if not exists public.ph_social_agent_commands (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.ph_social_pairing_devices(device_id) on delete cascade,
  operation text not null check (operation in ('tap_label','scroll_forward','scroll_backward','back')),
  label text,
  expected_revision integer not null,
  state text not null default 'queued' check (state in ('queued','claimed','done','failed','cancelled')),
  result text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '25 seconds')
);
create index if not exists ph_social_agent_commands_lookup
 on public.ph_social_agent_commands(device_id,state,created_at);
alter table public.ph_social_agent_commands enable row level security;
revoke all on public.ph_social_agent_commands from public, anon, authenticated;

create or replace function public.ph_social_agent_start(
 p_device_id uuid,p_device_token text,p_session_code text,p_duration_seconds integer default 900)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,extensions
as $$
begin
 if p_device_id is null or p_device_token !~ '^[a-f0-9]{64}$' or
   p_session_code !~ '^[A-Z2-7]{26}$' or
   p_duration_seconds not between 120 and 1200 then
   return jsonb_build_object('started',false);
 end if;
 if not exists(select 1 from public.ph_social_pairing_devices
   where device_id=p_device_id and paired_at is not null and
   device_hash=encode(extensions.digest(p_device_token,'sha256'),'hex')) then
   return jsonb_build_object('started',false);
 end if;
 insert into public.ph_social_agent_sessions(device_id,access_hash,expires_at,last_seen,revision,snapshot,opened_at)
 values(p_device_id,encode(extensions.digest(p_session_code,'sha256'),'hex'),now()+make_interval(secs=>p_duration_seconds),now(),0,null,now())
 on conflict (device_id) do update
 set access_hash=excluded.access_hash,expires_at=excluded.expires_at,last_seen=now(),
     revision=0,snapshot=null,opened_at=now();
 update public.ph_social_agent_commands set state='cancelled'
   where device_id=p_device_id and state in ('queued','claimed');
 return jsonb_build_object('started',true,'session_seconds',p_duration_seconds,
    'note','Owner-approved TikTok navigation session. Sensitive actions remain blocked.');
end $$;

create or replace function public.ph_social_agent_stop(p_device_id uuid,p_device_token text)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,extensions
as $$
declare affected uuid;
begin
 if p_device_id is null or p_device_token !~ '^[a-f0-9]{64}$' then return jsonb_build_object('stopped',false); end if;
 if not exists(select 1 from public.ph_social_pairing_devices
   where device_id=p_device_id and paired_at is not null and
   device_hash=encode(extensions.digest(p_device_token,'sha256'),'hex')) then
   return jsonb_build_object('stopped',false);
 end if;
 delete from public.ph_social_agent_sessions where device_id=p_device_id returning device_id into affected;
 update public.ph_social_agent_commands set state='cancelled'
 where device_id=p_device_id and state in ('queued','claimed');
 return jsonb_build_object('stopped',true);
end $$;

create or replace function public.ph_social_agent_update_screen(
 p_device_id uuid,p_device_token text,p_snapshot jsonb)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,extensions
as $$
declare rev integer;
begin
 if p_device_id is null or p_device_token !~ '^[a-f0-9]{64}$'
   or p_snapshot is null or jsonb_typeof(p_snapshot)<>'object'
   or octet_length(p_snapshot::text)>10000 then return jsonb_build_object('ok',false); end if;
 if p_snapshot->>'package'<>'com.zhiliaoapp.musically'
   or jsonb_typeof(p_snapshot->'elements')<>'array'
   or jsonb_array_length(p_snapshot->'elements')>100 then
   return jsonb_build_object('ok',false);
 end if;
 update public.ph_social_agent_sessions s
 set snapshot=p_snapshot,revision=revision+1,last_seen=now()
 where s.device_id=p_device_id and s.expires_at>now() and
   exists(select 1 from public.ph_social_pairing_devices p
     where p.device_id=p_device_id and p.paired_at is not null
     and p.device_hash=encode(extensions.digest(p_device_token,'sha256'),'hex'))
 returning revision into rev;
 return jsonb_build_object('ok',rev is not null,'revision',rev);
end $$;

create or replace function public.ph_social_agent_view(p_session_code text)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,extensions
as $$
declare s record; cmd record;
begin
 if p_session_code !~ '^[A-Z2-7]{26}$' then
  return jsonb_build_object('active',false);end if;
 select device_id,expires_at,last_seen,revision,snapshot into s
 from public.ph_social_agent_sessions
 where access_hash=encode(extensions.digest(p_session_code,'sha256'),'hex')
  and expires_at>now() limit 1;
 if not found then return jsonb_build_object('active',false);end if;
 select id,operation,state,result,created_at into cmd
 from public.ph_social_agent_commands where device_id=s.device_id
 order by created_at desc limit 1;
 return jsonb_build_object('active',true,'online',s.last_seen>now()-interval '25 seconds',
 'expires_at',s.expires_at,'revision',s.revision,'screen',s.snapshot,
 'last_action',case when cmd.id is null then null else jsonb_build_object(
  'id',cmd.id,'action',cmd.operation,'state',cmd.state,'result',cmd.result,'created_at',cmd.created_at) end);
end $$;

create or replace function public.ph_social_agent_queue(
 p_session_code text,p_operation text,p_label text,p_expected_revision integer)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,extensions
as $$
declare sid uuid; snap jsonb; rev integer; online_at timestamptz; queued uuid;
begin
 if p_session_code !~ '^[A-Z2-7]{26}$' or
 p_operation not in ('tap_label','scroll_forward','scroll_backward','back') or
 p_expected_revision is null or p_expected_revision<0 then
  return jsonb_build_object('queued',false,'reason','invalid parameters');end if;
 select device_id,snapshot,revision,last_seen into sid,snap,rev,online_at
 from public.ph_social_agent_sessions
 where access_hash=encode(extensions.digest(p_session_code,'sha256'),'hex')
 and expires_at>now() for update;
 if not found then return jsonb_build_object('queued',false,'reason','session expired');end if;
 if online_at is null or online_at<now()-interval '25 seconds' then
   return jsonb_build_object('queued',false,'reason','phone offline');end if;
 if p_expected_revision<>rev then
   return jsonb_build_object('queued',false,'reason','screen changed, inspect again');end if;
 if p_operation='tap_label' then
   if p_label is null or length(p_label) not between 1 and 65 or
      p_label ~* '(^|[^a-z])(post|publish|send|delete|confirm|pay|purchase|buy|withdraw|logout|sign out|block|report|follow|like|reply|comment|message|share|promote)([^a-z]|$)' then
      return jsonb_build_object('queued',false,'reason','sensitive tap is blocked');end if;
   if not exists (select 1 from jsonb_array_elements(snap->'elements') e
       where (e->>'label')=p_label and (e->>'clickable')='true') then
     return jsonb_build_object('queued',false,'reason','label not present on inspected screen');end if;
 else p_label:=null;end if;
 if exists(select 1 from public.ph_social_agent_commands
   where device_id=sid and state in ('queued','claimed') and expires_at>now()) then
   return jsonb_build_object('queued',false,'reason','previous action pending');end if;
 insert into public.ph_social_agent_commands(device_id,operation,label,expected_revision)
 values(sid,p_operation,p_label,p_expected_revision) returning id into queued;
 return jsonb_build_object('queued',true,'id',queued,'expires_in_seconds',25);
end $$;

create or replace function public.ph_social_agent_poll(p_device_id uuid,p_device_token text)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,extensions
as $$
declare result record;
begin
 if p_device_id is null or p_device_token !~ '^[a-f0-9]{64}$'
 or not exists(select 1 from public.ph_social_pairing_devices p
   where p.device_id=p_device_id and p.paired_at is not null
   and p.device_hash=encode(extensions.digest(p_device_token,'sha256'),'hex')) then
 return jsonb_build_object('active',false);end if;
 if not exists(select 1 from public.ph_social_agent_sessions
   where device_id=p_device_id and expires_at>now()) then return jsonb_build_object('active',false);end if;
 update public.ph_social_agent_commands set state='cancelled'
   where device_id=p_device_id and state='queued' and expires_at<now();
 update public.ph_social_agent_commands c set state='claimed'
 where id=(select id from public.ph_social_agent_commands
  where device_id=p_device_id and state='queued' and expires_at>now()
  order by created_at asc limit 1 for update skip locked)
 returning id,operation,label,expected_revision into result;
 if not found then return jsonb_build_object('active',true,'action',null);end if;
 return jsonb_build_object('active',true,'action',jsonb_build_object(
  'id',result.id,'operation',result.operation,'label',result.label,
  'expected_revision',result.expected_revision));
end $$;

create or replace function public.ph_social_agent_complete(
 p_device_id uuid,p_device_token text,p_command_id uuid,p_succeeded boolean,p_message text)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,extensions
as $$
declare done uuid;
begin
 if p_device_id is null or p_device_token !~ '^[a-f0-9]{64}$' or
 p_command_id is null or length(coalesce(p_message,''))>180 then
 return jsonb_build_object('ok',false);end if;
 if not exists(select 1 from public.ph_social_pairing_devices p
   where p.device_id=p_device_id and p.paired_at is not null
   and p.device_hash=encode(extensions.digest(p_device_token,'sha256'),'hex')) then
 return jsonb_build_object('ok',false);end if;
 update public.ph_social_agent_commands set
 state=case when p_succeeded then 'done' else 'failed' end,
 result=left(p_message,180)
 where id=p_command_id and device_id=p_device_id and state='claimed'
 returning id into done;
 return jsonb_build_object('ok',done is not null);
end $$;

revoke all on function public.ph_social_agent_start(uuid,text,text,integer) from public;
revoke all on function public.ph_social_agent_stop(uuid,text) from public;
revoke all on function public.ph_social_agent_update_screen(uuid,text,jsonb) from public;
revoke all on function public.ph_social_agent_view(text) from public;
revoke all on function public.ph_social_agent_queue(text,text,text,integer) from public;
revoke all on function public.ph_social_agent_poll(uuid,text) from public;
revoke all on function public.ph_social_agent_complete(uuid,text,uuid,boolean,text) from public;
grant execute on function public.ph_social_agent_start(uuid,text,text,integer) to anon;
grant execute on function public.ph_social_agent_stop(uuid,text) to anon;
grant execute on function public.ph_social_agent_update_screen(uuid,text,jsonb) to anon;
grant execute on function public.ph_social_agent_view(text) to anon;
grant execute on function public.ph_social_agent_queue(text,text,text,integer) to anon;
grant execute on function public.ph_social_agent_poll(uuid,text) to anon;
grant execute on function public.ph_social_agent_complete(uuid,text,uuid,boolean,text) to anon;