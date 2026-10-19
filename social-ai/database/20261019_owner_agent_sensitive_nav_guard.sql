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
      p_label ~* '(^|[^a-z])(post|publish|send|delete|confirm|pay|purchase|buy|withdraw|logout|sign out|block|report|follow|like|reply|comment|message|share|promote|login|log in|settings|security|switch account|add account|manage account)([^a-z]|$)' then
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
revoke all on function public.ph_social_agent_queue(text,text,text,integer) from public;
grant execute on function public.ph_social_agent_queue(text,text,text,integer) to anon;
