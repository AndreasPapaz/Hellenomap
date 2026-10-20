## 1. Project setup

- [x] 1.1 Scaffold a Next.js (App Router, TypeScript, Tailwind, ESLint) app at the repo root; verify `npm run dev` serves the default page and `npm run build` succeeds
- [x] 1.2 Add Vitest and Playwright test setup with one passing smoke test each; verify `npm test` and `npx playwright test` pass
- [x] 1.3 Add `.env.example` listing every variable (Supabase URL/anon/service keys, MapTiler key, Turnstile site/secret keys, `ADMIN_EMAILS`, `IP_HASH_SALT`), and git-ignore `.env*.local` and `scripts/.cache/`; verify `git status` doesn't show local env files

## 2. Database (Supabase + PostGIS)

- [x] 2.1 Initialize the Supabase CLI (`supabase/`) and write a migration enabling `postgis` and `pg_trgm`; verify `supabase db reset` applies cleanly on the local stack
- [x] 2.2 Migration for `category_groups`, `categories`, `source_category_map`, `businesses` (geography point + GiST index, status/published/origin, unique `source_url`, flags, `owner_edited_fields`), `business_categories`, `submission_private`, `moderation_events`, `admins`; verify via `supabase db reset` and `\d businesses`
- [x] 2.3 Seed the category taxonomy (groups such as Food & Dining, Professional Services, Health & Beauty, Retail, Home Services, Organizations & Churches, Education, Other) and `source_category_map` entries for all source `/listing-category/` slugs; verify each source slug maps to exactly one category
- [x] 2.4 Add the `is_admin()` function and RLS policies:
  - anon can select only approved+published businesses and their categories
  - no anon access to `submission_private`, `moderation_events` or `admins`
  - admins have full access

  Verify with a SQL test script that runs as the anon and admin roles
- [x] 2.5 Add the `businesses_in_view(bbox, ref_point, category_ids, group_ids, limit)` RPC returning distance-ordered approved rows; verify with SQL tests covering bbox filtering, group vs category filtering and distance ordering
- [x] 2.6 Generate TypeScript types (`supabase gen types`) and add server/browser Supabase client helpers; verify `npm run build` type-checks

## 3. Directory import (greekamericandirectory.com)

- [x] 3.1 Save 3–4 listing pages (complete listing, one missing website, one with multiple categories) plus the sitemap as test fixtures, and write a parser that extracts:
  - name, categories, address, coordinates, phone, website and description
  - coordinates come from `lestin_map_options`

  Verify Vitest fixture tests pass
- [x] 3.2 Implement a polite fetcher: robots.txt check, a descriptive User-Agent, at least 1 s between requests, and retry with backoff; verify a unit test asserting the request spacing
- [x] 3.3 Implement category mapping (unmapped → Other plus report) and geocoding fallback for listings missing coordinates (skip and report on failure); verify with unit tests
- [x] 3.4 Implement idempotent upsert by `source_url`. It must not overwrite `owner_edited_fields` or re-publish unpublished rows. Verify by running the import twice against local Supabase and checking the row count is unchanged and an unpublished row stays unpublished
- [x] 3.5 Wire up the `npm run import:gad -- [--dry-run]` CLI: it writes a JSON report (succeeded/failed/skipped/unmapped) and aborts without writes if the sitemap fetch fails. Verify a dry run against the live site reports about 126 listings with field coverage
- [x] 3.6 Run the real import into the local DB; verify that imported businesses appear in `businesses_in_view` around Chicago

## 4. Public map

- [x] 4.1 Build the map page layout: a full-viewport MapLibre map with MapTiler style, a search bar, a filter bar, and a results panel (side panel on desktop, bottom sheet on mobile). Verify by viewing it at 1280px and 375px with no horizontal scroll
- [x] 4.2 Load businesses for the current viewport via the `businesses_in_view` RPC (debounced on move), rendered as clustered GeoJSON markers; verify a Playwright test where panning updates markers and clicking a cluster zooms in
- [x] 4.3 Add a "Near me" button using browser geolocation, with a you-are-here marker and graceful handling of denial or unavailability; verify Playwright tests with mocked geolocation granted and denied
- [x] 4.4 Add location search using MapTiler geocoding with autocomplete; fly to the chosen place, and show "location not found" when nothing matches. Verify with Playwright, mocking the geocoder
- [x] 4.5 Add the results list ordered by distance from the reference point, showing name, primary category and distance, with an empty state linking to "Submit a business"; verify with a component test covering ordering and the empty state
- [x] 4.6 Add the category filter: group chips plus a category picker, applied to the RPC, with state synced to URL params (`lat,lng,z,cat,group,q`). Verify with Playwright that filtering to "Lawyer" shows only lawyers and that reloading the URL restores the view
- [x] 4.7 Add the business detail page (`/b/[slug]`, server-rendered) with tap-to-call, website, a "Get directions" link and source attribution for imported records, opened from a marker or list entry. Verify the page renders for an imported business and returns 404 for a pending one

## 5. Business submission

- [x] 5.1 Define the shared Zod submission schema (required name, categories, address and email; validated phone, URL and length limits); verify unit tests for valid and invalid inputs
- [x] 5.2 Build the `/submit` form page with a category picker, Turnstile widget, inline errors and a confirmation state; verify with Playwright that a missing address shows an error
- [x] 5.3 Write the submission server action, which does the following in order:
  - re-validates the input
  - verifies Turnstile
  - checks the hashed-IP rate limit (5/hour)
  - geocodes the address, setting `needs_location` on failure
  - detects duplicates (pg_trgm similarity with a 100 m radius)
  - inserts the pending business plus `submission_private`

  Verify integration tests for CAPTCHA failure, the 6th submission rejected, an ungeocodable address flagged, a near-duplicate flagged, and the pending row being invisible to anon

## 6. Owner moderation

- [x] 6.1 Add `/admin/login` with a Supabase magic link and middleware protecting `/admin/*`; verify that a non-allowlisted email cannot reach `/admin` and that a moderation action called directly by a non-admin is refused
- [x] 6.2 Build the pending queue page (oldest first, all fields including private ones, a mini map, flags shown); verify it lists seeded pending submissions in order
- [x] 6.3 Add the approve-with-edit flow: edit fields, categories and a draggable location pin. Approval is blocked while `needs_location` is set, and approved businesses become public. Verify with Playwright that an approved submission appears on the public map under the edited category
- [x] 6.4 Add the reject flow with an optional private reason; verify the rejected row stays non-public and is listed under "Rejected"
- [x] 6.5 Add an all-businesses page with search, edit (recording `owner_edited_fields`) and unpublish/republish; verify that unpublishing removes the business from the public RPC immediately
- [x] 6.6 Record a `moderation_events` row for every approve, reject, edit, unpublish and republish, shown as a history on the business admin view; verify an integration test asserts the events and the actor

## 7. Deploy to Vercel

- [x] 7.1 Create the hosted Supabase project, apply migrations, seed the admins from `ADMIN_EMAILS`, and run the production import; verify the row counts match the import report
- [ ] 7.2 Connect the repo to Vercel, configure env vars (Supabase integration plus MapTiler, Turnstile, `ADMIN_EMAILS` and `IP_HASH_SALT`), restrict the MapTiler key to the site domains, and deploy a preview; verify the preview build succeeds
- [ ] 7.3 End-to-end smoke test on the preview:
  - "Near me" works
  - searching for Chicago with the "Lawyer" filter shows only lawyers
  - the detail page works
  - submitting a business, then approving it as admin, makes it appear on the map

  Then promote to production
