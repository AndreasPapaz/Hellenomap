begin;
create extension if not exists pgtap with schema extensions;
-- Hermetic: start from no businesses (rolled back at the end).
delete from public.businesses;
select plan(10);

-- Reference point: downtown Chicago (-87.63, 41.88).
insert into public.businesses (id, slug, name, address, location, status, published, origin) values
  ('00000000-0000-0000-0000-0000000000a1', 'near-lawyer', 'Near Lawyer', 'x', 'SRID=4326;POINT(-87.631 41.881)', 'approved', true, 'import'),
  ('00000000-0000-0000-0000-0000000000a2', 'mid-deli', 'Mid Deli', 'x', 'SRID=4326;POINT(-87.68 41.92)', 'approved', true, 'import'),
  ('00000000-0000-0000-0000-0000000000a3', 'far-restaurant', 'Far Restaurant', 'x', 'SRID=4326;POINT(-87.80 42.05)', 'approved', true, 'import'),
  ('00000000-0000-0000-0000-0000000000a4', 'nyc-restaurant', 'NYC Restaurant', 'x', 'SRID=4326;POINT(-73.92 40.77)', 'approved', true, 'import'),
  ('00000000-0000-0000-0000-0000000000a5', 'pending-deli', 'Pending Deli', 'x', 'SRID=4326;POINT(-87.632 41.882)', 'pending', false, 'submission');
insert into public.business_categories (business_id, category_id, is_primary)
select v.id::uuid, c.id, v.is_primary
from (values
  ('00000000-0000-0000-0000-0000000000a1', 'lawyer', true),
  ('00000000-0000-0000-0000-0000000000a2', 'deli', true),
  ('00000000-0000-0000-0000-0000000000a3', 'restaurant', true),
  ('00000000-0000-0000-0000-0000000000a3', 'bar', false),
  ('00000000-0000-0000-0000-0000000000a4', 'restaurant', true),
  ('00000000-0000-0000-0000-0000000000a5', 'deli', true)
) v (id, slug, is_primary)
join public.categories c on c.slug = v.slug;

set local role anon;

select results_eq(
  $$select slug from public.businesses_in_view(-88.5, 41.5, -87.0, 42.5, -87.63, 41.88)$$,
  $$values ('near-lawyer'), ('mid-deli'), ('far-restaurant')$$,
  'bbox excludes NYC and pending; ordered nearest first');

select results_eq(
  $$select slug from public.businesses_in_view(-88.5, 41.5, -87.0, 42.5, -87.80, 42.05)$$,
  $$values ('far-restaurant'), ('mid-deli'), ('near-lawyer')$$,
  'ordering follows the reference point');

select results_eq(
  $$select slug from public.businesses_in_view(-88.5, 41.5, -87.0, 42.5, -87.63, 41.88, array['lawyer'])$$,
  $$values ('near-lawyer')$$,
  'category filter returns only that category');

select results_eq(
  $$select slug from public.businesses_in_view(-88.5, 41.5, -87.0, 42.5, -87.63, 41.88, '{}', array['food-dining'])$$,
  $$values ('mid-deli'), ('far-restaurant')$$,
  'group filter returns every category in the group');

select results_eq(
  $$select slug from public.businesses_in_view(-88.5, 41.5, -87.0, 42.5, -87.63, 41.88, array['lawyer'], array['food-dining'])$$,
  $$values ('near-lawyer'), ('mid-deli'), ('far-restaurant')$$,
  'category and group filters are OR-ed');

select results_eq(
  $$select primary_category_slug, group_slug, category_slugs_all from public.businesses_in_view(-88.5, 41.5, -87.0, 42.5, -87.80, 42.05, '{}', '{}', 1)$$,
  $$values ('restaurant', 'food-dining', array['bar', 'restaurant'])$$,
  'primary category and all categories are returned; max_results limits rows');

select ok(
  (select distance_m between 120 and 160 from public.businesses_in_view(-88.5, 41.5, -87.0, 42.5, -87.63, 41.88) where slug = 'near-lawyer'),
  'distance is in meters');

select results_eq(
  $$select count(*)::int from public.businesses_in_view(-180, -90, 180, 90, -87.63, 41.88)$$,
  $$values (4)$$, 'whole-world view returns everything');
select results_eq(
  $$select count(*)::int from public.businesses_in_view(-400, -85, 300, 85, -87.63, 41.88)$$,
  $$values (4)$$, 'views wider than 360 degrees return everything');
select results_eq(
  $$select slug from public.businesses_in_view(-460, 30, -350, 50, -87.63, 41.88) order by slug$$,
  $$values ('far-restaurant'), ('mid-deli'), ('near-lawyer'), ('nyc-restaurant')$$,
  'a view wrapped past the antimeridian still finds the US');

reset role;
select * from finish();
rollback;
