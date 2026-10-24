-- Retail Hub: dashboard independiente por tienda. Ejecutar una sola vez.
begin;
create table if not exists public.rh_dashboards (
 store_id uuid primary key references public.rh_stores(id) on delete cascade,
 revision integer not null default 1 check (revision > 0),
 items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) <= 500),
 updated_at timestamptz not null default now(),
 updated_by uuid
);
alter table public.rh_dashboards enable row level security;
revoke all on public.rh_dashboards from public, anon, authenticated;
grant all on public.rh_dashboards to service_role;
commit;
