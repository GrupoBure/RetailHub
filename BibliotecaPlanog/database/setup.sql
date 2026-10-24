-- Ejecutar una sola vez en el SQL Editor de un proyecto Supabase dedicado al portal.
create table if not exists public.rh_documents (
 id uuid primary key default gen_random_uuid(),
 dropbox_id text unique not null,
 title text not null,
 filename text not null,
 category text not null default 'General',
 size bigint not null default 0,
 revision text not null,
 modified_at timestamptz not null,
 published boolean not null default true,
 updated_at timestamptz not null default now()
);
alter table public.rh_documents enable row level security;
revoke all on public.rh_documents from public, anon, authenticated;
grant all on public.rh_documents to service_role;
create table if not exists public.rh_settings (
 key text primary key,
 value text not null
);
alter table public.rh_settings enable row level security;
revoke all on public.rh_settings from public, anon, authenticated;
grant all on public.rh_settings to service_role;
-- No hay políticas de lectura pública. La aplicación valida cada sesión en el servidor.

-- PRIMER ADMINISTRADOR:
-- 1. En Authentication > Users > Add user > Create new user, crear:
--    victor@usuarios.retailhub.invalid, contraseña propia y Auto Confirm User activado.
-- 2. Ejecutar la siguiente sentencia (sin los dos guiones iniciales):
-- update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data,'{}'::jsonb) ||
--   '{"rh_portal":true,"role":"admin","disabled":false}'::jsonb
-- where email = 'victor@usuarios.retailhub.invalid';
-- El usuario entrará al portal escribiendo únicamente victor y su contraseña.
