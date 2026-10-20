## Context

The repo is greenfield: only `README.md` and `openspec/` exist. See proposal.md for motivation and specs/ for requirements.

**What we found about the source site (inspected 2026-10-19):**
- greekamericandirectory.com is WordPress, running the Lestin directory theme on WP Job Manager. Listings are the `job_listing` post type at `/listing/<slug>/`, and categories live at `/listing-category/<slug>/`.
- `job_listing-sitemap.xml` lists about 126 listing URLs. All are in the Chicago area (region `/region/chicago/`).
- The WP REST API does **not** expose `job_listing` (`/wp-json/wp/v2/types` omits it), so we have to parse HTML.
- On a listing page:
  - Coordinates are in an inline script: `var lestin_map_options = {..."latitude":"41.92","longitude":"-87.68"...}`.
  - The address is in `.lt-info-address .info-value`.
  - The phone is an `a[href^="tel:"]`.
  - Categories are links to `/listing-category/…`.
- The source has about 18 top-level categories with subcategories, e.g. Restaurants & Dining → Bar, Breakfast, Coffee, Dinner, Lunch, Restaurant.
- robots.txt allows `/listing/` and states no terms on scraping. The site's legal pages haven't been reviewed (see Risks).

**Constraints:**
- Hosting is on Vercel.
- One owner moderates submissions.
- Traffic is low to moderate, and free or cheap tiers are strongly preferred.

## Goals / Non-Goals

**Goals:**
- A fast map-first experience on desktop and mobile, with indexable business detail pages.
- Real geospatial queries ("nearest N within the viewport, filtered by category") on the database rather than in the browser, so the app scales past the seed data.
- Moderation security enforced in the database (RLS), not only in the UI.
- Low running cost: fits Vercel Hobby and Supabase/MapTiler free tiers at launch.

**Non-Goals:**
- Accounts for the public or for business owners; submissions are anonymous plus an email.
- Business owners claiming or editing their own listings after publication.
- Reviews, ratings, photos uploads, hours of operation, events.
- Scheduled or automatic re-syncing from the source site; the import runs manually.
- Multi-language UI (Greek translation can come later).
- Notification emails to submitters on approval or rejection.

## Decisions

### 1. Database: Supabase (Postgres + PostGIS). This is the recommendation the user asked for.

**Why:**
- **PostGIS** gives indexed radius and bounding-box queries (`ST_DWithin`, `<->` KNN ordering on a GiST index). These are the core "near me, filtered by category" query.
- **Supabase Auth** gives emailed magic-link sign-in for the owner without building auth ourselves.
- **Row Level Security** lets the database itself guarantee that pending submissions and submitter emails are never readable by public clients.
- It has a first-class Vercel Marketplace integration that syncs env vars.
- The free tier is plenty for thousands of businesses.

**Alternatives considered:**
- **Neon Postgres + PostGIS.** This is Vercel's default Postgres and also supports PostGIS. It has no built-in auth, so we would add Auth.js and enforce access only in app code. It's a fine choice if you'd rather keep everything inside Vercel's billing.
- **Firebase Firestore.** It has no native geo queries (it needs geohash workarounds) and its category-plus-distance queries are awkward.
- **MongoDB Atlas.** Its 2dsphere indexes work, but it brings a separate auth story and a weaker relational fit for categories and audit logs.
- **A static JSON file.** It works for 126 rows but not for submissions or moderation.

### 2. App framework: Next.js (App Router, TypeScript) on Vercel

- Server Components and Route Handlers keep the Supabase service key server-side.
- Business detail pages (`/b/[slug]`) are server-rendered, so they're indexable and shareable.
- The map page is a client component.
- Styling uses Tailwind CSS.
- Validation uses Zod schemas shared between the form and the server action.

### 3. Map: MapLibre GL JS with MapTiler vector tiles + geocoding

**Why:**
- The UX is like Google Maps (smooth vector map, clustering, fly-to) without Google's billing setup.
- The MapTiler free tier covers tiles and the geocoding API, which handles both forward geocoding for search and submissions, with autocomplete.
- MapLibre is open source, so switching tile providers later only means a config change.
- Clustering uses MapLibre's built-in GeoJSON source clustering.
- **Fallbacks without a MapTiler key** (local development, or before the key is set up):
  - Tiles come from OpenFreeMap (free, no key).
  - Server-side geocoding goes to OSM Nominatim, which is only for low volume and has no autocomplete, per its usage policy.
  - Set `NEXT_PUBLIC_MAPTILER_KEY` in production.
- MapLibre v6 resolves its web worker relative to its own module URL, which breaks once Next bundles it. The worker is copied to `/public/vendor` on install and build, and set with `setWorkerUrl`.

**Alternatives considered:**
- **Google Maps JS API.** It's the most familiar look, but it needs a billing account and is per-load priced after the free quota. It's a viable swap if you specifically want Google's basemap.
- **Mapbox GL.** It's similar quality, but its v2+ license and pricing are less flexible than MapLibre + MapTiler.
- **Leaflet + OSM raster tiles.** It's simpler, but less smooth, and the public OSM tile servers forbid production heavy use.

### 4. Data model

The model is a set of Postgres tables plus one RPC function:
- **`category_groups`** (`id`, `slug`, `name`, `sort`): top-level groups, e.g. food-dining or professional-services.
  - The taxonomy mirrors the source directory's 2-level taxonomy, except that its three food groups (Restaurants & Dining, Food Markets, Food Production) are merged into "Food & Dining". That gives 14 groups and 99 categories.
  - A source listing tagged only with a group maps to that group's "Other" category, or for the food groups to Restaurant, Market or Food Manufacturer.
- **`categories`** (`id`, `group_id`, `slug`, `name`): specific categories, e.g. lawyer or deli. There is also an `other` category.
- **`source_category_map`** (`source_slug` → `category_id`): drives the import mapping. Unmapped slugs land in `other` and are reported.
- **`businesses`**: one row per business, both imported and submitted. A pending submission is just a business row whose `status` is `pending`.
  - Identity and descriptive fields: `id`, `slug`, `name`, `description`, `address`, `city`, `region`, `postal_code`, `country`, `phone`, `website`.
  - `location geography(Point,4326)`, with a GiST index.
  - `status` (`pending` | `approved` | `rejected`) and `published bool`.
  - `origin` (`import` | `submission`), `source_url` (unique, nullable) and `owner_edited_fields text[]`.
  - Flags: `needs_location`, `possible_duplicate_of`.
- **`business_categories`**: the many-to-many link between businesses and categories.
- **`submission_private`** (`business_id`, `submitter_email`, `ownership_note`, `client_hash`, `created_at`): a separate table so RLS can deny it to the public entirely.
- **`moderation_events`** (`business_id`, `actor`, `action`, `reason`, `diff jsonb`, `at`).
- **`admins`** (`email`): the allowlist. An RLS helper `is_admin()` checks `auth.email()` against it.
- **RPC `businesses_in_view(bbox, ref_point, category_slugs[], group_slugs[], limit)`**: returns approved, published rows intersecting the bbox, ordered by distance from `ref_point`. Category and group filters are OR-ed.
  - The viewport test is planar (`location::geometry` against a lng/lat envelope, with an expression GiST index). Latitudes are clamped and longitudes wrapped, and the box is split at the antimeridian. A geography envelope's great-circle edges break for zoomed-out views.
- **RPC `find_possible_duplicate(name, lng, lat)`**: callable by the service role only.
- **RPC `moderate_business(id, action, fields, categories, lng, lat, reason)`**:
  - It is the single, atomic entry point for approve, reject, edit, unpublish and republish.
  - It runs as the calling user and raises `42501` unless `is_admin()`.
  - It writes the `moderation_events` row, including a field diff, and appends edited fields of imported rows to `owner_edited_fields`.

Keeping submissions as rows in `businesses` means approval is a status flip plus edits, not a copy, and duplicate detection can query a single table.

**Public read path:** anonymous clients can read approved, published businesses through RLS. The map calls the RPC with the anon key.

**Write paths:**
- Public submissions go through a server action using the service role. It validates input, verifies the CAPTCHA, rate-limits and geocodes before inserting.
- Admin actions use the signed-in owner's own session (not the service role) and call `moderate_business`. RLS and the function's `is_admin()` check enforce authorization in the database, and the server action checks it first for a friendly error.

### 5. Import: TypeScript CLI script, run locally

- It lives at `scripts/import-gad/` and runs as `npm run import:gad -- [--dry-run] [--limit N]`.
- It fetches the sitemap and then each listing with `fetch`, and parses the HTML with `cheerio`.
  - Coordinates come from a regex on the `lestin_map_options` JSON.
  - The address comes from `.lt-info-address .info-value`.
  - The phone comes from `tel:` links.
  - Listing pages do **not** show categories. Instead:
    - The taxonomy comes from the public WP REST endpoint `/wp-json/wp/v2/job-categories`.
    - Membership comes from WP Job Manager's public `/jm-ajax/get_listings/` endpoint, queried once per category.
    - A group tag is dropped when the listing also has one of that group's child categories.
  - The website comes from the external link in the info widget.
  - The description comes from the content block.
- It throttles requests to at least 1 s apart, checks robots.txt, retries 5xx/429 responses with backoff, and sets a descriptive `User-Agent`.
- Listings with neither coordinates nor an address are skipped and reported. Of the 125 source listings, 6 are skipped this way.
- It upserts by `source_url`. On update, it skips any column listed in `owner_edited_fields` and never flips `published` back on.
- It writes a JSON report covering counts, failures and unmapped categories, and saves raw HTML snapshots to a git-ignored folder for debugging.
- It runs locally against Supabase with the service key rather than as a Vercel function, because it's a one-off and must not hit serverless timeouts.

### 6. Submission protection

- **Cloudflare Turnstile** (free, privacy-friendly) is verified in the server action.
- **Rate limiting** uses a Postgres count over `submission_private` by `client_hash`, a SHA-256 of IP plus a secret salt, so no extra Redis is needed.
- **Duplicate detection** looks for businesses within 100 m whose names match by `pg_trgm` similarity > 0.6.

### 7. Admin auth

- Sign-in uses a Supabase magic link at `/admin/login`, with a PKCE code exchange at `/auth/callback`.
- Links are only emailed to allowlisted addresses. Everyone sees the same confirmation, so the allowlist isn't revealed.
- Middleware protects `/admin/*`.
- RLS plus the `is_admin()` check in every server action is the real guard.
- The allowlist (`admins` table) is synced from the `ADMIN_EMAILS` env var with `npm run admins:sync`.

### 8. URL state

Map state lives in query params: `?lat=&lng=&z=&cat=lawyer&group=food-dining&q=`. This makes filtered views shareable, as the business-map spec requires.

## Risks / Trade-offs

- **Permission to reuse the source directory's data.** Facts like name, address and phone are generally not copyrightable, but descriptions and images are, and the site's terms weren't found.
  → Mitigation: import only factual fields plus short descriptions, link back to every source listing, and don't copy images. **Recommended:** contact the directory owner before launch; they may be glad to partner. The import is isolated, so it can be dropped without affecting the rest of the app.
- **Source HTML changes break the parser.**
  → Mitigation: selectors are centralized, with a fixture-based parser test on saved pages, and `--dry-run` reports field coverage before writing.
- **Seed data covers only Chicago, so the map looks empty elsewhere.**
  → Mitigation: a good empty state with a "Submit a business" CTA, and a default view on a region that has data when geolocation is unavailable.
- **Free-tier limits** (Supabase pauses inactive free projects; MapTiler has a monthly request quota).
  → Mitigation: monitor usage and upgrade if needed. Supabase Pro is $25/mo. Map provider config is swappable.
- **Spam submissions.**
  → Mitigation: Turnstile, the rate limit, and nothing goes public without approval.
- **Ambiguity of "Greek-owned".** This is the owner's judgment call during review, not automated. The ownership note field gives context.

## Migration Plan

1. Create the Supabase project, enable `postgis` and `pg_trgm`, and apply SQL migrations from `supabase/migrations/`.
2. Run the import with `--dry-run`, review the report and the category mapping, then run it for real.
3. Connect the GitHub repo to Vercel, add env vars (via the Supabase integration plus MapTiler and Turnstile keys and `ADMIN_EMAILS`), and deploy a preview.
4. Smoke-test the preview, then promote to production.

There's nothing to roll back to (greenfield). Imported data can be removed with `delete from businesses where origin='import'`.

## Open Questions

- Domain name for production (does not affect the build).
- Whether to email submitters on approval later (explicitly out of scope now).
