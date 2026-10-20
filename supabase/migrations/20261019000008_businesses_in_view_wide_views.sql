-- Fix businesses_in_view for zoomed-out views: test the bounding box in planar lng/lat
-- instead of as a geography envelope (whose great-circle edges misbehave for wide views).

create index businesses_location_geom_idx on public.businesses using gist ((location::extensions.geometry));

create or replace function public.businesses_in_view(
  min_lng double precision,
  min_lat double precision,
  max_lng double precision,
  max_lat double precision,
  ref_lng double precision,
  ref_lat double precision,
  category_slugs text[] default '{}',
  group_slugs text[] default '{}',
  max_results integer default 500
)
returns table (
  id uuid,
  slug text,
  name text,
  address text,
  phone text,
  website text,
  lat double precision,
  lng double precision,
  distance_m double precision,
  primary_category_slug text,
  primary_category_name text,
  group_slug text,
  category_slugs_all text[]
)
language sql stable security invoker set search_path = '' as $$
  with view_box as (
    -- The visible area in plain lng/lat (planar), clamped to valid latitudes, wrapped into
    -- [-180, 180] and split in two when the view crosses the antimeridian. A geography
    -- envelope can't be used: its edges are great circles, which breaks for wide views.
    select case
      when max_lng - min_lng >= 360 then
        extensions.st_makeenvelope(-180, lat_lo, 180, lat_hi, 4326)
      when wlo <= whi then
        extensions.st_makeenvelope(wlo, lat_lo, whi, lat_hi, 4326)
      else
        extensions.st_collect(
          extensions.st_makeenvelope(wlo, lat_lo, 180, lat_hi, 4326),
          extensions.st_makeenvelope(-180, lat_lo, whi, lat_hi, 4326))
    end as g
    from (
      select
        greatest(min_lat, -90) as lat_lo,
        least(max_lat, 90) as lat_hi,
        ((min_lng + 180)::numeric % 360 + 360) % 360 - 180 as wlo,
        ((max_lng + 180)::numeric % 360 + 360) % 360 - 180 as whi
    ) p
  ),
  ref as (
    select extensions.st_setsrid(extensions.st_makepoint(ref_lng, ref_lat), 4326)::extensions.geography as g
  ),
  filtered as (
    select b.*
    from public.businesses b
    where b.status = 'approved'
      and b.published
      and extensions.st_intersects(b.location::extensions.geometry, (select g from view_box))
      and (
        (coalesce(cardinality(category_slugs), 0) = 0 and coalesce(cardinality(group_slugs), 0) = 0)
        or exists (
          select 1
          from public.business_categories bc
          join public.categories c on c.id = bc.category_id
          join public.category_groups g on g.id = c.group_id
          where bc.business_id = b.id
            and (c.slug = any (category_slugs) or g.slug = any (group_slugs))
        )
      )
  )
  select
    f.id, f.slug, f.name, f.address, f.phone, f.website,
    extensions.st_y(f.location::extensions.geometry) as lat,
    extensions.st_x(f.location::extensions.geometry) as lng,
    extensions.st_distance(f.location, ref.g) as distance_m,
    pc.slug, pc.name, pc.group_slug,
    coalesce((
      select array_agg(c.slug order by c.slug)
      from public.business_categories bc join public.categories c on c.id = bc.category_id
      where bc.business_id = f.id
    ), '{}')
  from filtered f
  cross join ref
  left join lateral (
    select c.slug, c.name, g.slug as group_slug
    from public.business_categories bc
    join public.categories c on c.id = bc.category_id
    join public.category_groups g on g.id = c.group_id
    where bc.business_id = f.id
    order by bc.is_primary desc, c.sort, c.slug
    limit 1
  ) pc on true
  order by f.location operator(extensions.<->) ref.g
  limit least(greatest(max_results, 1), 1000);
$$;

grant execute on function public.businesses_in_view to anon, authenticated;
