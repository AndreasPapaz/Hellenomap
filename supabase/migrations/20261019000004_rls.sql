-- Row Level Security. The public may read only approved + published businesses;
-- everything else is admin-only. Server code that uses the service role bypasses RLS.

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.admins a
    where a.email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

alter table public.category_groups enable row level security;
alter table public.categories enable row level security;
alter table public.source_category_map enable row level security;
alter table public.businesses enable row level security;
alter table public.business_categories enable row level security;
alter table public.submission_private enable row level security;
alter table public.moderation_events enable row level security;
alter table public.admins enable row level security;

create policy "taxonomy is public" on public.category_groups for select using (true);
create policy "categories are public" on public.categories for select using (true);
create policy "admins manage groups" on public.category_groups for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage categories" on public.categories for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage source map" on public.source_category_map for all using (public.is_admin()) with check (public.is_admin());

create policy "public reads approved businesses" on public.businesses
  for select using (status = 'approved' and published);
create policy "admins manage businesses" on public.businesses
  for all using (public.is_admin()) with check (public.is_admin());

create policy "public reads categories of approved businesses" on public.business_categories
  for select using (exists (
    select 1 from public.businesses b
    where b.id = business_id and b.status = 'approved' and b.published
  ));
create policy "admins manage business categories" on public.business_categories
  for all using (public.is_admin()) with check (public.is_admin());

create policy "admins manage submissions" on public.submission_private
  for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage moderation events" on public.moderation_events
  for all using (public.is_admin()) with check (public.is_admin());
create policy "admins read admins" on public.admins
  for select using (public.is_admin());
