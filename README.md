# Hellenomap

An interactive map of Greek-owned businesses. Visitors find businesses near them or near a place they search, and can filter by category. Anyone can submit a business; the site owner reviews every submission before it appears.

- **App:** Next.js (App Router, TypeScript, Tailwind), deployed on Vercel.
- **Data:** Supabase (Postgres + PostGIS, Auth, Row Level Security).
- **Map:** MapLibre GL. Tiles and geocoding come from MapTiler when a key is set; without one, the app falls back to OpenFreeMap tiles and OSM Nominatim geocoding (development only).
- **Spam protection:** Cloudflare Turnstile.

Specs and design live in `openspec/changes/add-greek-business-map/`.

## Local development

Requirements: Node 22+, Docker.

```bash
npm install
npx supabase start          # local Postgres/Auth/Mailpit; applies supabase/migrations
npm run import:gad          # seed from greekamericandirectory.com (~4 min at 1 req/s)
ADMIN_EMAILS=you@example.com npm run admins:sync
npm run dev
```

`npm run dev` needs no `.env.local`. It uses the running local Supabase stack and Cloudflare's always-pass Turnstile test keys. To point dev at another project instead, create `.env.local` from `.env.example`; its values take precedence.

Sign-in emails for `/admin` arrive in the local Mailpit inbox at http://127.0.0.1:54324.

Scripts and tests don't need `.env.local`: they read the local Supabase credentials from `supabase status`.

| Command | What it does |
| --- | --- |
| `npm test` | Unit and integration tests (Vitest; integration tests need the local Supabase stack). |
| `npm run test:db` | Database tests (pgTAP): RLS, map query, duplicate detection, moderation. |
| `npm run test:e2e` | End-to-end tests (Playwright) against a production build. |
| `npm run import:gad -- --dry-run` | Crawl and report without writing. Add `--limit N` to try a few listings. |
| `npm run admins:sync` | Make the `admins` table match `ADMIN_EMAILS`. |
| `npm run db:types` | Regenerate `src/lib/supabase/database.types.ts`. |

## Deploying

1. **Supabase.**
   - Create a project.
   - Link the repo and push the migrations: `npx supabase link --project-ref <ref>`, then `npx supabase db push`.
   - In *Authentication → URL Configuration*, set the Site URL to your production domain. Add `https://<your-domain>/**` and `https://*-<your-vercel-team>.vercel.app/**` to the redirect URLs.
2. **Seed production.**
   - Run the import and the admin sync with the production credentials: `NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npm run import:gad`.
   - Then run `ADMIN_EMAILS=… npm run admins:sync` the same way.
3. **MapTiler.** Create a key and restrict it to your domains.
4. **Cloudflare Turnstile.** Create a widget for your domains to get the site and secret keys.
5. **Vercel.**
   - Import the GitHub repo.
   - Add the Supabase integration, or set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` yourself.
   - Also set `NEXT_PUBLIC_MAPTILER_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `ADMIN_EMAILS` and `IP_HASH_SALT` (a long random string).
   - Deploy a preview, smoke-test it, then promote it to production.

## Data source

The seed data comes from the public listings of [greekamericandirectory.com](https://greekamericandirectory.com). Imported businesses link back to their source listing. Only factual fields and descriptions are imported, not images. Please contact the directory's owner before launching publicly.
