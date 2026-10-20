-- Core directory schema. See openspec/changes/add-greek-business-map/design.md §4.

create type public.business_status as enum ('pending', 'approved', 'rejected');
create type public.business_origin as enum ('import', 'submission');
create type public.moderation_action as enum ('approve', 'reject', 'edit', 'unpublish', 'republish');

create table public.category_groups (
  id smallint generated always as identity primary key,
  slug text not null unique,
  name text not null,
  sort smallint not null default 0
);

create table public.categories (
  id smallint generated always as identity primary key,
  group_id smallint not null references public.category_groups (id) on delete restrict,
  slug text not null unique,
  name text not null,
  sort smallint not null default 0
);
create index categories_group_id_idx on public.categories (group_id);

-- Maps a greekamericandirectory.com job_listing_category slug to one of our categories.
create table public.source_category_map (
  source_slug text primary key,
  category_id smallint not null references public.categories (id) on delete restrict
);

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null check (char_length(name) between 1 and 200),
  description text check (char_length(description) <= 5000),
  address text not null check (char_length(address) <= 300),
  city text,
  region text,
  postal_code text,
  country text not null default 'US',
  phone text,
  website text,
  location extensions.geography(point, 4326),
  status public.business_status not null default 'pending',
  published boolean not null default false,
  origin public.business_origin not null,
  source_url text unique,
  owner_edited_fields text[] not null default '{}',
  needs_location boolean not null default false,
  possible_duplicate_of uuid references public.businesses (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint approved_requires_location check (status <> 'approved' or location is not null),
  constraint published_requires_approved check (not published or status = 'approved')
);
create index businesses_location_idx on public.businesses using gist (location);
create index businesses_status_idx on public.businesses (status, published);
create index businesses_name_trgm_idx on public.businesses using gin (name extensions.gin_trgm_ops);

create table public.business_categories (
  business_id uuid not null references public.businesses (id) on delete cascade,
  category_id smallint not null references public.categories (id) on delete restrict,
  is_primary boolean not null default false,
  primary key (business_id, category_id)
);
create index business_categories_category_idx on public.business_categories (category_id);

-- Submitter details, kept apart so RLS can hide them from the public entirely.
create table public.submission_private (
  business_id uuid primary key references public.businesses (id) on delete cascade,
  submitter_email text not null,
  ownership_note text check (char_length(ownership_note) <= 2000),
  client_hash text not null,
  created_at timestamptz not null default now()
);
create index submission_private_client_idx on public.submission_private (client_hash, created_at);

create table public.moderation_events (
  id bigint generated always as identity primary key,
  business_id uuid not null references public.businesses (id) on delete cascade,
  actor text not null,
  action public.moderation_action not null,
  reason text,
  diff jsonb,
  at timestamptz not null default now()
);
create index moderation_events_business_idx on public.moderation_events (business_id, at desc);

create table public.admins (
  email text primary key check (email = lower(email))
);

create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger businesses_touch_updated_at
before update on public.businesses
for each row execute function public.touch_updated_at();
