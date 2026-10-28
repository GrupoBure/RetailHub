-- Biblioteca Retail Hub: solo asignaciones, firmas y control de envíos.
-- Los mensajes y adjuntos permanecen en Namecheap.
begin;
do $$ begin
 if to_regclass('public.rh_stores') is null or to_regclass('public.rh_documents') is null then
  raise exception 'Proyecto incorrecto: ejecuta 009 en Biblioteca Retail Hub, donde están rh_stores y rh_documents.';
 end if;
end $$;
create table if not exists public.rh_mail_accounts (
 id uuid primary key default gen_random_uuid(),
 email text not null unique check(email=lower(email) and email ~ '^[a-z0-9][a-z0-9._-]{0,63}@retailhub[.]mx$'),
 owner_id uuid references auth.users(id) on delete set null,
 enabled boolean not null default false,
 encrypted_password text not null,
 signature jsonb not null default '{}'::jsonb check(jsonb_typeof(signature)='object'),
 revision integer not null default 1,
 updated_at timestamptz not null default now()
);
create unique index if not exists rh_mail_one_account_per_user on public.rh_mail_accounts(owner_id) where owner_id is not null;
create table if not exists public.rh_mail_sends (
 id uuid primary key, account_id uuid not null references public.rh_mail_accounts(id),
 user_id uuid not null, payload_hash text not null check(length(payload_hash)=64),
 message_id text not null, status text not null check(status in ('preparing','sending','sent','failed','unknown')),
 copy_saved boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists rh_mail_sends_rate on public.rh_mail_sends(account_id,created_at);
alter table public.rh_mail_accounts enable row level security;
alter table public.rh_mail_sends enable row level security;
revoke all on public.rh_mail_accounts,public.rh_mail_sends from public,anon,authenticated;
grant all on public.rh_mail_accounts,public.rh_mail_sends to service_role;

create or replace function public.rh_mail_assign(p_admin uuid,p_id uuid,p_email text,p_owner uuid,p_enabled boolean,p_password text,p_revision integer,p_confirm boolean)
returns uuid language plpgsql security definer set search_path=public as $$
declare meta jsonb; target jsonb; old public.rh_mail_accounts; result_id uuid; sig jsonb;
begin
 select raw_app_meta_data into meta from auth.users where id=p_admin;
 if meta is null or coalesce((meta->>'rh_portal')::boolean,false)=false or coalesce((meta->>'disabled')::boolean,false) or meta->>'role' is distinct from 'admin' then raise exception 'mail_access'; end if;
 if p_owner is not null then
  select raw_app_meta_data into target from auth.users where id=p_owner;
  if target is null or coalesce((target->>'rh_portal')::boolean,false)=false or coalesce((target->>'disabled')::boolean,false) then raise exception 'mail_owner'; end if;
 end if;
 if p_enabled and p_owner is null then raise exception 'mail_owner'; end if;
 if length(coalesce(p_password,''))<20 then raise exception 'mail_password'; end if;
 if p_id is not null then
  select * into old from public.rh_mail_accounts where id=p_id for update;
  if not found or old.revision is distinct from p_revision then raise exception 'mail_conflict'; end if;
  if old.email<>p_email then raise exception 'mail_email'; end if;
  if old.owner_id is distinct from p_owner and old.owner_id is not null and not coalesce(p_confirm,false) then raise exception 'mail_confirm'; end if;
  sig=case when old.owner_id is not distinct from p_owner then old.signature else '{}'::jsonb end;
  update public.rh_mail_accounts set owner_id=p_owner,enabled=p_enabled,encrypted_password=p_password,signature=sig,revision=revision+1,updated_at=now() where id=p_id;
  return p_id;
 end if;
 insert into public.rh_mail_accounts(email,owner_id,enabled,encrypted_password) values(p_email,p_owner,p_enabled,p_password) returning id into result_id;
 return result_id;
end $$;

create or replace function public.rh_mail_claim_send(p_user uuid,p_account uuid,p_revision integer,p_id uuid,p_hash text,p_message_id text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare meta jsonb; account public.rh_mail_accounts; previous public.rh_mail_sends;
begin
 select raw_app_meta_data into meta from auth.users where id=p_user;
 if meta is null or coalesce((meta->>'rh_portal')::boolean,false)=false or coalesce((meta->>'disabled')::boolean,false) then raise exception 'mail_access'; end if;
 select * into account from public.rh_mail_accounts where id=p_account for update;
 if not found or account.owner_id is distinct from p_user or not account.enabled or account.revision is distinct from p_revision then raise exception 'mail_access'; end if;
 select * into previous from public.rh_mail_sends where id=p_id;
 if found then
  if previous.user_id<>p_user or previous.account_id<>p_account or previous.payload_hash<>p_hash then raise exception 'mail_conflict'; end if;
  return jsonb_build_object('created',false,'status',previous.status,'copy_saved',previous.copy_saved,'message_id',previous.message_id);
 end if;
 if (select count(*) from public.rh_mail_sends where account_id=p_account and created_at>now()-interval '1 minute')>=10
 or (select count(*) from public.rh_mail_sends where account_id=p_account and created_at>now()-interval '1 hour')>=60 then raise exception 'mail_rate'; end if;
 insert into public.rh_mail_sends(id,account_id,user_id,payload_hash,message_id,status) values(p_id,p_account,p_user,p_hash,p_message_id,'preparing');
 return jsonb_build_object('created',true,'status','preparing','message_id',p_message_id);
end $$;
revoke all on function public.rh_mail_assign(uuid,uuid,text,uuid,boolean,text,integer,boolean) from public,anon,authenticated;
revoke all on function public.rh_mail_claim_send(uuid,uuid,integer,uuid,text,text) from public,anon,authenticated;
grant execute on function public.rh_mail_assign(uuid,uuid,text,uuid,boolean,text,integer,boolean) to service_role;
grant execute on function public.rh_mail_claim_send(uuid,uuid,integer,uuid,text,text) to service_role;
commit;
