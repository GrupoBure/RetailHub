alter table public.rh_provider_pending add column completion_note text not null default '' check (length(completion_note)<=3000);
