-- PrimeHub Social AI — isolated owner pairing records. No customer/store tables changed.
-- This release authorizes only device pairing + minimal online status. NO remote control.
create table if not exists public.ph_social_pairing_devices (
  device_id uuid primary key,
  device_hash text not null,
  pair_hash text not null unique,
  created_at timestamptz not null default now(),
  pending_until timestamptz not null,
  paired_at timestamptz,
  last_seen timestamptz
);
alter table public.ph_social_pairing_devices enable row level security;
revoke all on public.ph_social_pairing_devices from public, anon, authenticated;
-- SECURITY DEFINER functions contain all authorized access, no table/list API.

create or replace function public.ph_social_begin_pair(
  p_device_id uuid, p_device_token text, p_pair_code text
) returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  d_hash text;
  c_hash text;
  found uuid;
begin
  if p_device_id is null or p_device_token !~ '^[a-f0-9]{64}$'
    or p_pair_code !~ '^[A-Z2-7]{26}$' then
    raise exception 'Invalid pairing format';
  end if;
  d_hash := encode(extensions.digest(p_device_token,'sha256'),'hex');
  c_hash := encode(extensions.digest(p_pair_code,'sha256'),'hex');
  -- Re-enrollment only possible for device holders. Other IDs cannot be taken over.
  update public.ph_social_pairing_devices
    set pair_hash=c_hash, pending_until=now()+interval '15 minutes',
        paired_at=null, last_seen=now()
    where device_id=p_device_id and device_hash=d_hash
    returning device_id into found;
  if found is null then
    if exists(select 1 from public.ph_social_pairing_devices where device_id=p_device_id) then
      raise exception 'Device authorization failed';
    end if;
    -- Keep allocation low for this personal owner tool; no mass device provisioning.
    if (select count(*) from public.ph_social_pairing_devices) >= 10 then
      raise exception 'Device enrollment limit reached';
    end if;
    insert into public.ph_social_pairing_devices
      (device_id,device_hash,pair_hash,pending_until,last_seen)
    values (p_device_id,d_hash,c_hash,now()+interval '15 minutes',now());
  end if;
  return jsonb_build_object('registered',true,'expires_in_seconds',900,
      'paired',false);
end $$;

create or replace function public.ph_social_finish_pair(p_pair_code text)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  updated uuid;
begin
  if p_pair_code !~ '^[A-Z2-7]{26}$' then
    return jsonb_build_object('paired',false,'reason','Invalid pairing code');
  end if;
  update public.ph_social_pairing_devices
  set paired_at=now()
  where pair_hash=encode(extensions.digest(p_pair_code,'sha256'),'hex')
    and pending_until>now()
    and paired_at is null
  returning device_id into updated;
  if updated is null then
    return jsonb_build_object('paired',false,
      'reason','Code missing, already paired or expired. Reset the code on the phone.');
  end if;
  return jsonb_build_object('paired',true,
    'message','Pairing accepted. The Android owner controls this device.');
end $$;

create or replace function public.ph_social_heartbeat(
  p_device_id uuid, p_device_token text
) returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  paired timestamptz;
  found uuid;
begin
  if p_device_id is null or p_device_token !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('authorized',false);
  end if;
  update public.ph_social_pairing_devices
  set last_seen=now()
  where device_id=p_device_id and device_hash=encode(extensions.digest(p_device_token,'sha256'),'hex')
  returning device_id, paired_at into found, paired;
  if found is null then return jsonb_build_object('authorized',false); end if;
  return jsonb_build_object('authorized',true,'paired',paired is not null,
    'online','while pairing screen is open');
end $$;

create or replace function public.ph_social_owner_status(p_pair_code text)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  p record;
begin
  if p_pair_code !~ '^[A-Z2-7]{26}$' then
    return jsonb_build_object('found',false);
  end if;
  select paired_at,last_seen,pending_until into p
    from public.ph_social_pairing_devices
    where pair_hash=encode(extensions.digest(p_pair_code,'sha256'),'hex')
    limit 1;
  if not found then return jsonb_build_object('found',false); end if;
  return jsonb_build_object(
    'found',true,
    'paired',p.paired_at is not null,
    'online',p.last_seen>now()-interval '3 minutes',
    'last_seen',p.last_seen,
    'pending_expired',p.paired_at is null and p.pending_until<now(),
    'capabilities',jsonb_build_array('pairing','owner-approved task handoff','foreground-only heartbeat'),
    'can_control_other_apps',false);
end $$;

create or replace function public.ph_social_revoke(
  p_device_id uuid, p_device_token text
) returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, extensions
as $$
declare removed uuid;
begin
  if p_device_id is null or p_device_token !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('revoked',false);
  end if;
  delete from public.ph_social_pairing_devices
    where device_id=p_device_id and device_hash=encode(extensions.digest(p_device_token,'sha256'),'hex')
    returning device_id into removed;
  return jsonb_build_object('revoked',removed is not null);
end $$;

revoke all on function public.ph_social_begin_pair(uuid,text,text) from public;
revoke all on function public.ph_social_finish_pair(text) from public;
revoke all on function public.ph_social_heartbeat(uuid,text) from public;
revoke all on function public.ph_social_owner_status(text) from public;
revoke all on function public.ph_social_revoke(uuid,text) from public;
grant execute on function public.ph_social_begin_pair(uuid,text,text) to anon;
grant execute on function public.ph_social_finish_pair(text) to anon;
grant execute on function public.ph_social_heartbeat(uuid,text) to anon;
grant execute on function public.ph_social_owner_status(text) to anon;
grant execute on function public.ph_social_revoke(uuid,text) to anon;
