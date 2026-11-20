create table public.rh_pending_providers (
 id uuid primary key default gen_random_uuid(),
 name text not null check (length(btrim(name)) between 1 and 100)
);
create unique index rh_pending_provider_name on public.rh_pending_providers (lower(name));
create table public.rh_pending_permissions (
 provider_id uuid not null references public.rh_pending_providers on delete cascade,
 user_id uuid not null references auth.users on delete cascade,
 section text not null check (section in ('delivery','improvements','designs')),
 can_edit boolean not null default false,
 primary key (provider_id,user_id,section)
);
create table public.rh_provider_pending (
 id uuid primary key default gen_random_uuid(),
 provider_id uuid not null references public.rh_pending_providers on delete cascade,
 section text not null check (section in ('delivery','improvements','designs')),
 title text not null check (length(btrim(title)) between 1 and 120),
 description text not null check (length(btrim(description)) between 1 and 3000),
 location text not null default '' check (length(location)<=160),
 suggestion text not null default '' check (length(suggestion)<=3000),
 solution text not null default '' check (length(solution)<=3000),
 photo text check (length(photo)<=800000),
 updated_at timestamptz not null default now(),
 completed_at timestamptz,
 completed_by text
);
create index rh_provider_pending_section on public.rh_provider_pending (provider_id,section,updated_at);
alter table public.rh_pending_providers enable row level security;
alter table public.rh_pending_permissions enable row level security;
alter table public.rh_provider_pending enable row level security;
revoke all on public.rh_pending_providers, public.rh_pending_permissions, public.rh_provider_pending from anon, authenticated, public;
grant select,insert,update,delete on public.rh_pending_providers, public.rh_pending_permissions, public.rh_provider_pending to service_role;
