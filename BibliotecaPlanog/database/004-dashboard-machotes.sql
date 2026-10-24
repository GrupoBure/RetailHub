-- Machotes reutilizables del dashboard. Ejecutar después de 003-dashboard.sql.
begin;
create table if not exists public.rh_dashboard_templates (
 id uuid primary key default gen_random_uuid(),
 name text not null check (char_length(name) between 1 and 100),
 items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) <= 500),
 item_count integer not null check (item_count between 0 and 500),
 created_at timestamptz not null default now(),
 created_by uuid
);
alter table public.rh_dashboard_templates enable row level security;
revoke all on public.rh_dashboard_templates from public, anon, authenticated;
grant all on public.rh_dashboard_templates to service_role;
commit;
