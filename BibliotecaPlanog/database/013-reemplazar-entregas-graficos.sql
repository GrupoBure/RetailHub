create or replace function public.rh_replace_graphic_deliveries(
  p_store uuid, p_expected uuid[], p_rows jsonb
) returns integer
language plpgsql security invoker set search_path = ''
as $$
declare
  previous jsonb;
  actual uuid[];
  inserted integer;
begin
  if p_store is null or p_expected is null or jsonb_typeof(p_rows) is distinct from 'array'
     or jsonb_array_length(p_rows) not between 1 and 4000 then
    raise exception 'Invalid graphic delivery import';
  end if;
  lock table public.rh_graphic_deliveries in share row exclusive mode;
  select coalesce(array_agg(revision order by revision), '{}'::uuid[]),
         coalesce(jsonb_agg(to_jsonb(g)), '[]'::jsonb)
    into actual, previous
    from public.rh_graphic_deliveries g where store_id = p_store;
  if actual is distinct from array(select x from unnest(p_expected) x order by x) then
    return -1;
  end if;

  delete from public.rh_graphic_deliveries where store_id = p_store;
  with incoming as (
    select value as row, ordinality as position,
      count(*) over (partition by value->'data'->>'name', value->'data'->>'folder', value->'data'->>'origin') as same_name
    from jsonb_array_elements(p_rows) with ordinality
  )
  insert into public.rh_graphic_deliveries (store_id, position, data, delivered_at, delivered_by)
  select p_store, i.position, i.row->'data', (match.item->>'delivered_at')::timestamptz, match.item->>'delivered_by'
  from incoming i
  left join lateral (
    select case when count(*) = 1 then jsonb_agg(old.item)->0 end as item
    from jsonb_array_elements(previous) old(item)
    where (i.row->>'id' is not null and old.item->>'id' = i.row->>'id')
       or (i.row->>'id' is null and i.same_name = 1
           and old.item->'data'->>'name' = i.row->'data'->>'name'
           and old.item->'data'->>'folder' = i.row->'data'->>'folder'
           and old.item->'data'->>'origin' = i.row->'data'->>'origin')
  ) match on true;
  get diagnostics inserted = row_count;
  return inserted;
end;
$$;
revoke all on function public.rh_replace_graphic_deliveries(uuid, uuid[], jsonb) from public, anon, authenticated;
grant execute on function public.rh_replace_graphic_deliveries(uuid, uuid[], jsonb) to service_role;
