-- Submission duplicate check: an existing non-rejected business with a similar name
-- (pg_trgm similarity > 0.6) within 100 m. Called by the server with the service role.

create function public.find_possible_duplicate(
  candidate_name text,
  lng double precision,
  lat double precision
)
returns uuid
language sql stable set search_path = '' as $$
  select b.id
  from public.businesses b
  where b.status <> 'rejected'
    and b.location is not null
    and extensions.st_dwithin(
      b.location,
      extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography,
      100
    )
    and extensions.similarity(lower(b.name), lower(candidate_name)) > 0.6
  order by extensions.similarity(lower(b.name), lower(candidate_name)) desc
  limit 1;
$$;

revoke execute on function public.find_possible_duplicate from public, anon, authenticated;
grant execute on function public.find_possible_duplicate to service_role;
