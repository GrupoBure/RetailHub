create table if not exists public.rh_graphic_deliveries (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.rh_stores(id),
  position integer not null default 2147483647,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  delivered_at timestamptz,
  delivered_by text,
  revision uuid not null default gen_random_uuid()
);

create index if not exists rh_graphic_deliveries_store_order
  on public.rh_graphic_deliveries (store_id, position, id);

alter table public.rh_graphic_deliveries enable row level security;
revoke all on public.rh_graphic_deliveries from public, anon, authenticated;
grant select, insert, update, delete on public.rh_graphic_deliveries to service_role;
