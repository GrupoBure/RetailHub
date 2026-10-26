-- Comparativos privados por tienda. No cambia documentos ni dashboards existentes.
begin;
create table if not exists public.rh_quote_boards (
 id uuid primary key default gen_random_uuid(),
 store_id uuid not null references public.rh_stores(id),
 title text not null,
 revision integer not null default 1 check (revision>0),
 published boolean not null default false,
 data jsonb not null,
 updated_at timestamptz not null default now()
);
create index if not exists rh_quote_boards_store_idx on public.rh_quote_boards(store_id);
create table if not exists public.rh_quote_approvals (
 id uuid primary key default gen_random_uuid(),
 board_id uuid not null references public.rh_quote_boards(id),
 board_revision integer not null,
 offer_id uuid not null,
 approved_by uuid not null,
 approved_name text not null,
 approved_at timestamptz not null default now(),
 snapshot jsonb not null,
 unique(board_id,board_revision)
);
create table if not exists public.rh_quote_files (
 id uuid primary key,
 board_id uuid not null references public.rh_quote_boards(id),
 dropbox_id text not null,
 revision text not null,
 filename text not null,
 created_at timestamptz not null default now()
);
alter table public.rh_quote_files enable row level security;
revoke all on public.rh_quote_files from public,anon,authenticated;
grant all on public.rh_quote_files to service_role;
alter table public.rh_quote_boards enable row level security;
alter table public.rh_quote_approvals enable row level security;
revoke all on public.rh_quote_boards,public.rh_quote_approvals from public,anon,authenticated;
grant all on public.rh_quote_boards,public.rh_quote_approvals to service_role;
-- Lock the compared version while recording an immutable approval snapshot.
create or replace function public.rh_approve_quote(p_board uuid,p_revision integer,p_offer uuid,p_user uuid,p_name text,p_partial boolean)
returns uuid language plpgsql security definer set search_path=public as $$
declare b public.rh_quote_boards; chosen jsonb; approval_id uuid; meta jsonb; subtotal bigint;
begin
 select * into b from public.rh_quote_boards where id=p_board for update;
 if not found or not b.published or b.revision<>p_revision then raise exception 'quote_conflict'; end if;
 if not exists(select 1 from public.rh_stores where id=b.store_id and enabled) then raise exception 'quote_access'; end if;
 select raw_app_meta_data into meta from auth.users where id=p_user;
 if meta is null or coalesce((meta->>'rh_portal')::boolean,false)=false or coalesce((meta->>'disabled')::boolean,false) then raise exception 'quote_access'; end if;
 if coalesce(meta->>'role','reader')<>'admin' and (coalesce((meta->>'quote_approval')::boolean,false)=false or not coalesce(meta->'store_ids','[]'::jsonb) @> jsonb_build_array(b.store_id::text)) then raise exception 'quote_access'; end if;
 select value into chosen from jsonb_array_elements(b.data->'offers') where value->>'id'=p_offer::text;
 if chosen is null or chosen->>'shipping' is null or chosen->>'lead_days' is null or coalesce(chosen->>'lead_basis','')='' then raise exception 'quote_incomplete'; end if;
 if jsonb_array_length(chosen->'lines')=0 or exists(select 1 from jsonb_array_elements(chosen->'lines') l where l->>'review'<>'confirmed' or l->>'amount' is null or l->>'quantity' is null) then raise exception 'quote_incomplete'; end if;
 select coalesce(sum((l->>'amount')::bigint),0) into subtotal from jsonb_array_elements(chosen->'lines') l;
 if chosen->>'reported_subtotal' is not null and abs((chosen->>'reported_subtotal')::bigint-subtotal)>1 then raise exception 'quote_incomplete'; end if;
 if exists(select 1 from jsonb_array_elements(b.data->'requests') r where (coalesce(r->>'width','')<>'' or coalesce(r->>'height','')<>'') and (coalesce(r->>'unit','')='' or r->>'unit' ~* 'confirmar|pendiente') and exists(select 1 from jsonb_array_elements(chosen->'lines') l where l->>'request_id'=r->>'id')) then raise exception 'quote_incomplete'; end if;
 if not p_partial and exists(select 1 from jsonb_array_elements(b.data->'requests') r where not exists(select 1 from jsonb_array_elements(chosen->'lines') l where l->>'request_id'=r->>'id' and l->>'amount' is not null)) then raise exception 'quote_partial'; end if;
 insert into public.rh_quote_approvals(board_id,board_revision,offer_id,approved_by,approved_name,snapshot)
 values(b.id,b.revision,p_offer,p_user,p_name,jsonb_build_object('data',b.data,'offer_id',p_offer,'partial',p_partial,'files',coalesce((select jsonb_agg(jsonb_build_object('id',id,'filename',filename,'dropbox_id',dropbox_id,'revision',revision)) from public.rh_quote_files where board_id=b.id),'[]'::jsonb))) returning id into approval_id;
 return approval_id;
end $$;
revoke all on function public.rh_approve_quote(uuid,integer,uuid,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.rh_approve_quote(uuid,integer,uuid,uuid,text,boolean) to service_role;
commit;
