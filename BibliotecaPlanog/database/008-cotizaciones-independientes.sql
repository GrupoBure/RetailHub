-- Ejecutar en Biblioteca Retail Hub. No retira ni transforma comparativos existentes.
begin;
create table if not exists public.rh_quote_suppliers (
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 150),
 name_key text not null unique, defaults jsonb not null default '{}'::jsonb,
 revision integer not null default 1, created_by uuid not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.rh_quote_records (
 id uuid primary key default gen_random_uuid(),store_id uuid not null references public.rh_stores(id),
 kind text not null check(kind in ('quote','request','template','comparison-template')),
 title text not null check(length(title) between 1 and 200),data jsonb not null check(jsonb_typeof(data)='object'),
 revision integer not null default 1,created_by uuid not null,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),deleted_at timestamptz
);
create index if not exists rh_quote_records_store_idx on public.rh_quote_records(store_id,id) where deleted_at is null;
alter table public.rh_quote_suppliers enable row level security;
alter table public.rh_quote_records enable row level security;
revoke all on public.rh_quote_suppliers,public.rh_quote_records from public,anon,authenticated;
grant all on public.rh_quote_suppliers,public.rh_quote_records to service_role;
alter table public.rh_quote_files alter column board_id drop not null;
alter table public.rh_quote_files add column if not exists document_id uuid references public.rh_quote_records(id);
do $$ begin
 if not exists(select 1 from pg_constraint where conname='rh_quote_files_one_owner') then
 alter table public.rh_quote_files add constraint rh_quote_files_one_owner check((board_id is null) <> (document_id is null));
 end if;
end $$;
alter table public.rh_quote_boards add column if not exists source_snapshots jsonb not null default '[]'::jsonb;
create or replace function public.rh_create_record_comparison(p_store uuid,p_data jsonb,p_sources jsonb,p_user uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare meta jsonb; src jsonb; rec public.rh_quote_records; snapshots jsonb := '[]'::jsonb; result_id uuid;
begin
 select raw_app_meta_data into meta from auth.users where id=p_user;
 if meta is null or coalesce((meta->>'rh_portal')::boolean,false)=false or coalesce((meta->>'disabled')::boolean,false) or coalesce(meta->>'role','reader')<>'admin' then raise exception 'quote_access'; end if;
 if not exists(select 1 from public.rh_stores where id=p_store and enabled) then raise exception 'quote_access'; end if;
 if jsonb_typeof(p_sources)<>'array' or jsonb_array_length(p_sources) not between 1 and 11 then raise exception 'quote_conflict'; end if;
 for src in select value from jsonb_array_elements(p_sources) order by value->>'id' loop
 select * into rec from public.rh_quote_records where id=(src->>'id')::uuid and store_id=p_store and deleted_at is null and kind in ('quote','request') for share;
 if not found or rec.revision<>(src->>'revision')::integer then raise exception 'quote_conflict'; end if;
 snapshots := snapshots || jsonb_build_array(jsonb_build_object('id',rec.id,'revision',rec.revision,'title',rec.title,'data',rec.data));
 end loop;
 insert into public.rh_quote_boards(store_id,title,data,published,revision,source_snapshots) values(p_store,p_data->>'title',p_data,false,1,snapshots) returning id into result_id;
 insert into public.rh_quote_files(id,board_id,dropbox_id,revision,filename)
 select gen_random_uuid(),result_id,f.dropbox_id,f.revision,f.filename from public.rh_quote_files f
 where f.document_id in (select (value->>'id')::uuid from jsonb_array_elements(p_sources));
 return result_id;
end $$;
revoke all on function public.rh_create_record_comparison(uuid,jsonb,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.rh_create_record_comparison(uuid,jsonb,jsonb,uuid) to service_role;
create or replace function public.rh_approve_quote(p_board uuid,p_revision integer,p_offer uuid,p_user uuid,p_name text,p_partial boolean)
returns uuid language plpgsql security definer set search_path=public as $$
declare b public.rh_quote_boards; chosen jsonb; approval_id uuid; meta jsonb; subtotal bigint;
begin
 select * into b from public.rh_quote_boards where id=p_board for update;
 if not found or b.deleted_at is not null or not b.published or b.revision<>p_revision then raise exception 'quote_conflict'; end if;
 if not exists(select 1 from public.rh_stores where id=b.store_id and enabled) then raise exception 'quote_access'; end if;
 select raw_app_meta_data into meta from auth.users where id=p_user;
 if meta is null or coalesce((meta->>'rh_portal')::boolean,false)=false or coalesce((meta->>'disabled')::boolean,false) then raise exception 'quote_access'; end if;
 if coalesce(meta->>'role','reader')<>'admin' and (not coalesce(meta->'quote_view_store_ids','[]'::jsonb) @> jsonb_build_array(b.store_id::text) or not coalesce(meta->'quote_approve_store_ids','[]'::jsonb) @> jsonb_build_array(b.store_id::text)) then raise exception 'quote_access'; end if;
 select value into chosen from jsonb_array_elements(b.data->'offers') where value->>'id'=p_offer::text;
 if chosen is null or chosen->>'shipping' is null or chosen->>'lead_days' is null or coalesce(chosen->>'lead_basis','')='' then raise exception 'quote_incomplete'; end if;
 if jsonb_array_length(chosen->'lines')=0 or exists(select 1 from jsonb_array_elements(chosen->'lines') l where l->>'review'<>'confirmed' or l->>'amount' is null or l->>'quantity' is null) then raise exception 'quote_incomplete'; end if;
 select coalesce(sum((l->>'amount')::bigint),0) into subtotal from jsonb_array_elements(chosen->'lines') l;
 if chosen->>'reported_subtotal' is not null and abs((chosen->>'reported_subtotal')::bigint-subtotal)>1 then raise exception 'quote_incomplete'; end if;
 if exists(select 1 from jsonb_array_elements(b.data->'requests') r where (coalesce(r->>'width','')<>'' or coalesce(r->>'height','')<>'') and (coalesce(r->>'unit','')='' or r->>'unit' ~* 'confirmar|pendiente') and exists(select 1 from jsonb_array_elements(chosen->'lines') l where l->>'request_id'=r->>'id')) then raise exception 'quote_incomplete'; end if;
 if exists(select 1 from jsonb_array_elements(b.data->'requests') r where r->>'quantity' is null and exists(select 1 from jsonb_array_elements(chosen->'lines') l where l->>'request_id'=r->>'id')) then raise exception 'quote_incomplete'; end if;
 if not p_partial and exists(select 1 from jsonb_array_elements(b.data->'requests') r where not exists(select 1 from jsonb_array_elements(chosen->'lines') l where l->>'request_id'=r->>'id' and l->>'amount' is not null)) then raise exception 'quote_partial'; end if;
 insert into public.rh_quote_approvals(board_id,board_revision,offer_id,approved_by,approved_name,snapshot)
 values(b.id,b.revision,p_offer,p_user,p_name,jsonb_build_object('data',b.data,'offer_id',p_offer,'partial',p_partial,'files',coalesce((select jsonb_agg(jsonb_build_object('id',id,'filename',filename,'dropbox_id',dropbox_id,'revision',revision)) from public.rh_quote_files where board_id=b.id),'[]'::jsonb))) returning id into approval_id;
 return approval_id;
end $$;
revoke all on function public.rh_approve_quote(uuid,integer,uuid,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.rh_approve_quote(uuid,integer,uuid,uuid,text,boolean) to service_role;


notify pgrst,'reload schema';
commit;
