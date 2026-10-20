begin;
create extension if not exists pgtap with schema extensions;
-- Hermetic: start from no businesses (rolled back at the end).
delete from public.businesses;
select plan(4);

insert into public.businesses (id, slug, name, address, location, status, published, origin) values
  ('00000000-0000-0000-0000-0000000000d1', 'dup-agora', 'Agora Market', 'x', 'SRID=4326;POINT(-87.68803 41.92107)', 'approved', true, 'import');

select is(public.find_possible_duplicate('Agora Market', -87.68810, 41.92120),
  '00000000-0000-0000-0000-0000000000d1'::uuid, 'same name ~20 m away is a duplicate');
select is(public.find_possible_duplicate('agora market chicago', -87.68810, 41.92120),
  '00000000-0000-0000-0000-0000000000d1'::uuid, 'similar name matches case-insensitively');
select is(public.find_possible_duplicate('Agora Market', -87.6900, 41.9230), null, 'same name ~270 m away is not');
select is(public.find_possible_duplicate('Hellas Law Group', -87.68810, 41.92120), null, 'different name nearby is not');

select * from finish();
rollback;
