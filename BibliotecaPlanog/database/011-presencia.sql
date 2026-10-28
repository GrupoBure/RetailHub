begin;
do $$ begin
 if to_regclass('public.rh_activity_sessions') is null then raise exception 'Aplica 010 primero en Biblioteca Retail Hub.'; end if;
end $$;
alter table public.rh_activity_sessions add column if not exists last_activity timestamptz;
-- Previous signals remain last_seen; do not invent historical interaction times.
create or replace function public.rh_activity_record(p_user uuid,p_session uuid,p_name text,p_username text,p_kind text)
returns boolean language plpgsql security definer set search_path=public as $$
declare meta jsonb;
begin
 select raw_app_meta_data into meta from auth.users where id=p_user;
 if meta is null or coalesce((meta->>'rh_portal')::boolean,false)=false or coalesce((meta->>'disabled')::boolean,false) then raise exception 'activity_access'; end if;
 if p_kind not in ('login','pulse','idle','logout') or p_session is null then raise exception 'activity_input'; end if;
 insert into public.rh_activity_sessions(session_id,user_id,name,username,login_at,logout_at,last_activity)
 values(p_session,p_user,left(p_name,100),left(p_username,100),case when p_kind='login' then now() else null end,case when p_kind='logout' then now() else null end,case when p_kind in ('login','pulse') then now() else null end)
 on conflict(session_id) do update set last_seen=now(),last_activity=case when p_kind in ('login','pulse') then now() else rh_activity_sessions.last_activity end,logout_at=case when p_kind='logout' then now() else rh_activity_sessions.logout_at end
 where rh_activity_sessions.user_id=p_user and rh_activity_sessions.logout_at is null;
 return true;
end $$;
create or replace function public.rh_activity_report(p_admin uuid,p_from timestamptz,p_to timestamptz,p_user uuid,p_offset integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare meta jsonb; result jsonb;
begin
 select raw_app_meta_data into meta from auth.users where id=p_admin;
 if meta is null or coalesce((meta->>'rh_portal')::boolean,false)=false or coalesce((meta->>'disabled')::boolean,false) or meta->>'role' is distinct from 'admin' then raise exception 'activity_access'; end if;
 if p_offset<0 or p_offset>1000000 or p_from is null or p_to is null or p_to<=p_from or p_to-p_from>interval '367 days' then raise exception 'activity_input'; end if;
 with filtered as(select * from public.rh_activity_sessions where last_seen>=p_from and detected_at<p_to and (p_user is null or user_id=p_user)),
 page as(select * from filtered order by detected_at desc,session_id limit 100 offset p_offset)
 select jsonb_build_object('presence_version',2,'total',(select count(*) from filtered),'recent',(select count(*) from filtered where logout_at is null and last_seen>now()-interval '3 minutes'),'closed',(select count(*) from filtered where logout_at is not null),'rows',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb),'server_time',now()) into result;
 return result;
end $$;
revoke all on function public.rh_activity_record(uuid,uuid,text,text,text),public.rh_activity_report(uuid,timestamptz,timestamptz,uuid,integer) from public,anon,authenticated;
grant execute on function public.rh_activity_record(uuid,uuid,text,text,text),public.rh_activity_report(uuid,timestamptz,timestamptz,uuid,integer) to service_role;
commit;
