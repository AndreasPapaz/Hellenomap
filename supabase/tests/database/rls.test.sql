begin;
create extension if not exists pgtap with schema extensions;
-- Hermetic: start from no businesses (rolled back at the end).
delete from public.businesses;
select plan(12);

insert into public.admins (email) values ('owner@example.com');
insert into public.businesses (id, slug, name, address, location, status, published, origin) values
  ('00000000-0000-0000-0000-000000000001', 'approved-biz', 'Approved', '1 A St', 'SRID=4326;POINT(-87.68 41.92)', 'approved', true, 'import'),
  ('00000000-0000-0000-0000-000000000002', 'pending-biz', 'Pending', '2 B St', 'SRID=4326;POINT(-87.68 41.92)', 'pending', false, 'submission'),
  ('00000000-0000-0000-0000-000000000003', 'unpublished-biz', 'Unpublished', '3 C St', 'SRID=4326;POINT(-87.68 41.92)', 'approved', false, 'import'),
  ('00000000-0000-0000-0000-000000000004', 'rejected-biz', 'Rejected', '4 D St', null, 'rejected', false, 'submission');
insert into public.business_categories (business_id, category_id)
  select b.id, c.id from public.businesses b, public.categories c
  where c.slug = 'lawyer' and b.slug like '%-biz';
insert into public.submission_private (business_id, submitter_email, client_hash)
  values ('00000000-0000-0000-0000-000000000002', 'someone@example.com', 'h');
insert into public.moderation_events (business_id, actor, action)
  values ('00000000-0000-0000-0000-000000000001', 'owner@example.com', 'approve');

-- Anonymous visitor
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select results_eq($$select slug from public.businesses where slug like '%-biz' order by slug$$, $$values ('approved-biz')$$,
  'anon sees only approved + published businesses');
select results_eq($$select count(*)::int from public.business_categories bc join public.businesses b on b.id = bc.business_id where b.slug like '%-biz'$$, $$values (1)$$,
  'anon sees categories only of public businesses');
select is_empty('select * from public.submission_private', 'anon cannot read submitter details');
select is_empty('select * from public.moderation_events', 'anon cannot read moderation events');
select is_empty('select * from public.admins', 'anon cannot read admins');
select isnt_empty('select * from public.categories', 'anon can read the taxonomy');
select throws_ok($$insert into public.businesses (slug, name, address, origin) values ('x', 'x', 'x', 'submission')$$,
  '42501', null, 'anon cannot insert businesses directly');
update public.businesses set published = true where slug = 'unpublished-biz';
reset role;
select is((select published from public.businesses where slug = 'unpublished-biz'), false,
  'anon update has no effect');

-- Authenticated but not on the allowlist
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","email":"stranger@example.com"}', true);
select results_eq($$select count(*)::int from public.businesses where slug like '%-biz'$$, $$values (1)$$,
  'non-admin user sees only public businesses');
select is_empty('select * from public.submission_private', 'non-admin cannot read submitter details');

-- Allowlisted owner
select set_config('request.jwt.claims', '{"role":"authenticated","email":"Owner@Example.com"}', true);
select results_eq($$select count(*)::int from public.businesses where slug like '%-biz'$$, $$values (4)$$,
  'admin sees all businesses (email match is case-insensitive)');
select results_eq('select submitter_email from public.submission_private', $$values ('someone@example.com')$$,
  'admin reads submitter details');

reset role;
select * from finish();
rollback;
