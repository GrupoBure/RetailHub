begin;
do $$ begin
 if to_regclass('public.rh_stores') is null then raise exception 'Ejecuta 010 en Biblioteca Retail Hub.'; end if;
end $$;
create table if not exists public.rh_activity_sessions(
 session_id uuid primary key,user_id uuid not null,name text not null,username text not null,
 detected_at timestamptz not null default now(),login_at timestamptz,last_seen timestamptz not null default now(),logout_at timestamptz
);
create index if not exists rh_activity_date on public.rh_activity_sessions(detected_at desc);
create index if not exists rh_activity_user on public.rh_activity_sessions(user_id,detected_at desc);
alter table public.rh_activity_sessions enable row level security;
revoke all on public.rh_activity_sessions from public,anon,authenticated;
grant all on public.rh_activity_sessions to service_role;
create or replace function public.rh_activity_record(p_user uuid,p_session uuid,p_name text,p_username text,p_kind text)
returns boolean language plpgsql security definer set search_path=public as $$
declare meta jsonb;
begin
 select raw_app_meta_data into meta from auth.users where id=p_user;
 if meta is null or coalesce((meta->>'rh_portal')::boolean,false)=false or coalesce((meta->>'disabled')::boolean,false) then raise exception 'activity_access'; end if;
 if p_kind not in ('login','pulse','logout') or p_session is null then raise exception 'activity_input'; end if;
 insert into public.rh_activity_sessions(session_id,user_id,name,username,login_at,logout_at)
 values(p_session,p_user,left(p_name,100),left(p_username,100),case when p_kind='login' then now() else null end,case when p_kind='logout' then now() else null end)
 on conflict(session_id) do update set last_seen=now(),logout_at=case when p_kind='logout' then now() else rh_activity_sessions.logout_at end
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
 with filtered as(select * from public.rh_activity_sessions where detected_at>=p_from and detected_at<p_to and (p_user is null or user_id=p_user)),
 page as(select * from filtered order by detected_at desc,session_id limit 100 offset p_offset)
 select jsonb_build_object('total',(select count(*) from filtered),'recent',(select count(*) from filtered where logout_at is null and last_seen>now()-interval '3 minutes'),'closed',(select count(*) from filtered where logout_at is not null),'rows',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb),'server_time',now()) into result;
 return result;
end $$;
revoke all on function public.rh_activity_record(uuid,uuid,text,text,text),public.rh_activity_report(uuid,timestamptz,timestamptz,uuid,integer) from public,anon,authenticated;
grant execute on function public.rh_activity_record(uuid,uuid,text,text,text),public.rh_activity_report(uuid,timestamptz,timestamptz,uuid,integer) to service_role;
commit;
