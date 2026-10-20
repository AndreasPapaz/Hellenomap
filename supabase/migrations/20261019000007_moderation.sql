-- Owner moderation: one atomic entry point for approve / reject / edit / unpublish / republish.
-- Runs as the calling user (security invoker) and refuses non-admins, so authorization is
-- enforced in the database even if application code is wrong.

create function public.moderate_business(
  p_id uuid,
  p_action public.moderation_action,
  p_fields jsonb default '{}',          -- any of: name, description, address, phone, website
  p_categories text[] default null,     -- category slugs, primary first; null = unchanged
  p_lng double precision default null,  -- new location; null = unchanged
  p_lat double precision default null,
  p_reason text default null
)
returns void
language plpgsql security invoker set search_path = '' as $$
declare
  old_row public.businesses;
  new_row public.businesses;
  old_cats text[];
  new_cats text[];
  diff jsonb := '{}';
  changed text[] := '{}';
  k text;
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select * into old_row from public.businesses where id = p_id for update;
  if not found then
    raise exception 'business not found' using errcode = 'P0002';
  end if;

  if (p_lng is null) <> (p_lat is null) then
    raise exception 'both latitude and longitude are required' using errcode = '22023';
  end if;

  select coalesce(array_agg(c.slug order by bc.is_primary desc, c.slug), '{}') into old_cats
  from public.business_categories bc join public.categories c on c.id = bc.category_id
  where bc.business_id = p_id;

  update public.businesses b set
    name = case when p_fields ? 'name' then p_fields ->> 'name' else b.name end,
    description = case when p_fields ? 'description' then p_fields ->> 'description' else b.description end,
    address = case when p_fields ? 'address' then p_fields ->> 'address' else b.address end,
    phone = case when p_fields ? 'phone' then p_fields ->> 'phone' else b.phone end,
    website = case when p_fields ? 'website' then p_fields ->> 'website' else b.website end,
    location = case when p_lng is not null
      then extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography
      else b.location end,
    needs_location = case when p_lng is not null then false else b.needs_location end
  where b.id = p_id;

  if p_categories is not null then
    if cardinality(p_categories) = 0 then
      raise exception 'at least one category is required' using errcode = '22023';
    end if;
    if (select count(*) from public.categories where slug = any (p_categories)) <> cardinality(p_categories) then
      raise exception 'unknown category' using errcode = '22023';
    end if;
    delete from public.business_categories where business_id = p_id;
    insert into public.business_categories (business_id, category_id, is_primary)
    select p_id, c.id, s.ord = 1
    from unnest(p_categories) with ordinality as s (slug, ord)
    join public.categories c on c.slug = s.slug;
    new_cats := (select array_agg(c.slug order by bc.is_primary desc, c.slug)
                 from public.business_categories bc join public.categories c on c.id = bc.category_id
                 where bc.business_id = p_id);
  else
    new_cats := old_cats;
  end if;

  case p_action
    when 'approve' then
      if (select location from public.businesses where id = p_id) is null then
        raise exception 'set a location before approving' using errcode = '22023';
      end if;
      update public.businesses set status = 'approved', published = true where id = p_id;
    when 'reject' then
      update public.businesses set status = 'rejected', published = false where id = p_id;
    when 'unpublish' then
      update public.businesses set published = false where id = p_id;
    when 'republish' then
      if old_row.status <> 'approved' then
        raise exception 'only approved businesses can be republished' using errcode = '22023';
      end if;
      update public.businesses set published = true where id = p_id;
    when 'edit' then
      null;
  end case;

  select * into new_row from public.businesses where id = p_id;

  foreach k in array array['name', 'description', 'address', 'phone', 'website', 'status', 'published'] loop
    if (to_jsonb(old_row) -> k) is distinct from (to_jsonb(new_row) -> k) then
      diff := diff || jsonb_build_object(k, jsonb_build_object('from', to_jsonb(old_row) -> k, 'to', to_jsonb(new_row) -> k));
      if k not in ('status', 'published') then changed := changed || k; end if;
    end if;
  end loop;
  if old_row.location is distinct from new_row.location then
    diff := diff || jsonb_build_object('location', jsonb_build_object(
      'from', extensions.st_asgeojson(old_row.location)::jsonb,
      'to', extensions.st_asgeojson(new_row.location)::jsonb));
    changed := changed || 'location'::text;
  end if;
  if old_cats is distinct from new_cats then
    diff := diff || jsonb_build_object('categories', jsonb_build_object('from', to_jsonb(old_cats), 'to', to_jsonb(new_cats)));
    changed := changed || 'categories'::text;
  end if;

  -- Imported listings remember owner edits so re-running the import won't overwrite them.
  if new_row.origin = 'import' and cardinality(changed) > 0 then
    update public.businesses
    set owner_edited_fields = (select array_agg(distinct f) from unnest(owner_edited_fields || changed) f)
    where id = p_id;
  end if;

  insert into public.moderation_events (business_id, actor, action, reason, diff)
  values (p_id, coalesce(auth.jwt() ->> 'email', 'unknown'), p_action, nullif(trim(p_reason), ''),
          case when diff = '{}' then null else diff end);
end;
$$;

revoke execute on function public.moderate_business from public, anon;
grant execute on function public.moderate_business to authenticated;
