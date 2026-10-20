## Why

There's no single, map-first place where people can find Greek-owned businesses near them, such as a Greek deli, a Greek-American lawyer or a Greek school, filtered by what they need. The existing directory, greekamericandirectory.com, has about 126 verified listings, all in the Chicago area. Those listings can seed a new, community-grown map that anyone can add to and that the site owner curates.

## What Changes

- New Hellenomap web app (greenfield), deployed on Vercel, with a full-screen interactive map in the style of Google Maps showing Greek-owned businesses.
- Location-aware discovery: the map centers on the user's current location (browser geolocation, with permission) or on a location they type (address, city or ZIP). It lists nearby businesses sorted by distance.
- Category filtering: users filter by a top-level category (e.g. "Food & Dining") or a specific one (e.g. "Lawyer"), and only matching approved businesses appear on the map and in the list.
- Business detail view: name, category, address, phone, website, description and a directions link.
- One-time, re-runnable import of listings from greekamericandirectory.com. Each listing is parsed for name, categories, address, coordinates, phone, website and description, mapped into our category taxonomy, and stored with attribution to the source URL.
- Public "Submit a business" form. Submissions go into a pending queue and never appear on the map until approved.
- Owner-only moderation area for reviewing pending submissions (approve, edit, reject) and for unpublishing existing listings.
- Database recommendation: Supabase, which is managed Postgres with PostGIS. See design.md for the rationale and alternatives.

## Capabilities

### New Capabilities
- `directory-import`: Importing and normalizing business listings from greekamericandirectory.com into the directory, including category mapping, attribution and idempotent re-runs.
- `business-map`: Public map and list discovery. Covers location by geolocation or search, nearby results by distance, category filtering, map markers and the business detail view.
- `business-submission`: Public submission of new businesses, with validation, address geocoding, spam protection and a pending status.
- `submission-review`: Owner-only moderation, covering authentication, the pending queue, approve/edit/reject, and unpublishing listings.

### Modified Capabilities
None. There are no existing specs.

## Impact

- **New codebase**: a Next.js (TypeScript) app at the repo root, deployed to Vercel.
- **New external services**:
  - Supabase: Postgres with PostGIS, Auth and Row Level Security.
  - A map tile and geocoding provider (MapTiler, used through MapLibre GL).
  - A CAPTCHA provider (Cloudflare Turnstile).
- **Secrets and configuration**: Supabase URL and keys, the map/geocoding API key, Turnstile keys and the admin email allowlist, all held in Vercel environment variables.
- **Data provenance**: imported records keep their source URL. Scraping someone else's directory carries permission and attribution considerations, covered in design.md under Risks.
- **Initial coverage**: seed data is Chicago-only, so other regions start empty until submissions grow them.
