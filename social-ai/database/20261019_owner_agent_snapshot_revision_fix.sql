-- Avoid invalidating the AI's inspected revision for identical TikTok UI snapshots.
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
 set snapshot=p_snapshot,
     revision=case when s.snapshot is distinct from p_snapshot then s.revision+1 else s.revision end,
     last_seen=now()
 where s.device_id=p_device_id and s.expires_at>now() and
   exists(select 1 from public.ph_social_pairing_devices p
     where p.device_id=p_device_id and p.paired_at is not null
     and p.device_hash=encode(extensions.digest(p_device_token,'sha256'),'hex'))
 returning revision into rev;
 return jsonb_build_object('ok',rev is not null,'revision',rev);
end $$;
revoke all on function public.ph_social_agent_update_screen(uuid,text,jsonb) from public;
grant execute on function public.ph_social_agent_update_screen(uuid,text,jsonb) to anon;