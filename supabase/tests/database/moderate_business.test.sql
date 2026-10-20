begin;
create extension if not exists pgtap with schema extensions;
-- Hermetic: start from no businesses (rolled back at the end).
delete from public.businesses;
select plan(16);

insert into public.admins (email) values ('owner@example.com');
insert into public.businesses (id, slug, name, address, location, status, published, origin, needs_location, source_url) values
  ('00000000-0000-0000-0000-0000000000e1', 'pending-ok', 'Pending OK', '1 A St', 'SRID=4326;POINT(-87.6 41.9)', 'pending', false, 'submission', false, null),
  ('00000000-0000-0000-0000-0000000000e2', 'pending-noloc', 'Pending NoLoc', '2 B St', null, 'pending', false, 'submission', true, null),
  ('00000000-0000-0000-0000-0000000000e3', 'imported', 'Imported', '3 C St', 'SRID=4326;POINT(-87.6 41.9)', 'approved', true, 'import', false, 'https://example.com/listing/imported/');
insert into public.business_categories (business_id, category_id, is_primary)
  select '00000000-0000-0000-0000-0000000000e1', id, true from public.categories where slug = 'deli';

-- Non-admin is refused.
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","email":"stranger@example.com"}', true);
select throws_ok($$select public.moderate_business('00000000-0000-0000-0000-0000000000e1', 'approve')$$,
  '42501', 'not authorized', 'non-admin cannot moderate');

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$select public.moderate_business('00000000-0000-0000-0000-0000000000e1', 'approve')$$,
  '42501', null, 'anon cannot call moderation');

-- Admin.
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","email":"owner@example.com"}', true);

select lives_ok($$select public.moderate_business('00000000-0000-0000-0000-0000000000e1', 'approve',
  '{"name": "Pending OK Bakery"}', array['bakery'])$$, 'admin approves with edits');
select results_eq($$select status::text, published, name from public.businesses where slug = 'pending-ok'$$,
  $$values ('approved', true, 'Pending OK Bakery')$$, 'approved, published and renamed');
select results_eq($$select c.slug from public.business_categories bc join public.categories c on c.id = bc.category_id
  where bc.business_id = '00000000-0000-0000-0000-0000000000e1' and bc.is_primary$$, $$values ('bakery')$$, 'category replaced');
select results_eq($$select actor, action::text, diff ? 'name', diff ? 'categories', diff ? 'status' from public.moderation_events
  where business_id = '00000000-0000-0000-0000-0000000000e1'$$,
  $$values ('owner@example.com', 'approve', true, true, true)$$, 'approval is audited with a diff');

select throws_ok($$select public.moderate_business('00000000-0000-0000-0000-0000000000e2', 'approve')$$,
  '22023', 'set a location before approving', 'cannot approve without a location');
select lives_ok($$select public.moderate_business('00000000-0000-0000-0000-0000000000e2', 'approve', '{}', array['deli'], -87.61, 41.91)$$,
  'can approve once a location is set');
select results_eq($$select needs_location, status::text from public.businesses where slug = 'pending-noloc'$$,
  $$values (false, 'approved')$$, 'location clears the flag');

select lives_ok($$select public.moderate_business('00000000-0000-0000-0000-0000000000e2', 'reject', '{}', null, null, null, 'not Greek-owned')$$,
  'admin rejects');
select results_eq($$select status::text, published from public.businesses where slug = 'pending-noloc'$$,
  $$values ('rejected', false)$$, 'rejected and hidden');
select results_eq($$select reason from public.moderation_events where business_id = '00000000-0000-0000-0000-0000000000e2' and action = 'reject'$$,
  $$values ('not Greek-owned')$$, 'reject reason stored');

select lives_ok($$select public.moderate_business('00000000-0000-0000-0000-0000000000e3', 'edit', '{"phone": "(312) 555-0000"}')$$,
  'admin edits an imported listing');
select results_eq($$select owner_edited_fields from public.businesses where slug = 'imported'$$,
  $$values (array['phone'])$$, 'edited fields are protected from re-import');

select lives_ok($$select public.moderate_business('00000000-0000-0000-0000-0000000000e3', 'unpublish')$$, 'admin unpublishes');
select results_eq($$select action::text from public.moderation_events where business_id = '00000000-0000-0000-0000-0000000000e3' order by at, id$$,
  $$values ('edit'), ('unpublish')$$, 'every action is recorded');

reset role;
select * from finish();
rollback;
