-- Retail Hub: tiendas y acceso por usuario. Ejecutar ANTES de desplegar la función nueva.
-- No borra documentos, usuarios ni archivos de Dropbox.
begin;
create table if not exists public.rh_stores (
 id uuid primary key default gen_random_uuid(),
 dropbox_id text unique not null,
 name text not null,
 path_lower text not null,
 enabled boolean not null default true,
 updated_at timestamptz not null default now()
);
alter table public.rh_stores enable row level security;
revoke all on public.rh_stores from public, anon, authenticated;
grant all on public.rh_stores to service_role;
alter table public.rh_documents add column if not exists store_id uuid references public.rh_stores(id);
create index if not exists rh_documents_store_id_idx on public.rh_documents(store_id);
-- Los permisos de tiendas se guardan en auth.users.raw_app_meta_data.store_ids.
-- Solo el servidor administrador puede asignarlos. No se confía en user_metadata ni
-- en el JWT del navegador: cada solicitud obtiene el usuario vigente desde Auth.
-- Sin tiendas asignadas, un lector no tiene acceso a ningún PDF.
-- Los documentos anteriores quedan sin tienda hasta reorganizar Dropbox y sincronizar.
commit;
