// Imports listings from greekamericandirectory.com.
//   npm run import:gad -- [--dry-run] [--limit N]
// Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (falls back to the local stack).
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../src/lib/supabase/database.types";
import { geocode } from "../../src/lib/geocode";
import { loadLocalSupabaseEnv } from "../lib/local-env";
import { mapCategories } from "./categories";
import { PoliteFetcher } from "./fetcher";
import { normalizeUrl, parseGetListings, parseListing, parseSitemap, type SourceCategory } from "./parse";
import { buildRecord, loadCategoryIds, loadSourceCategoryMap, upsertBusiness } from "./upsert";

const ORIGIN = "https://greekamericandirectory.com";
const USER_AGENT = process.env.IMPORT_USER_AGENT ?? "HellenomapImporter/1.0 (Greek-owned business map; one-time import, 1 req/s)";
const CACHE_DIR = path.join(__dirname, "..", ".cache");

type Report = {
  startedAt: string;
  dryRun: boolean;
  discovered: number;
  succeeded: number;
  created: number;
  updated: number;
  geocoded: number;
  failed: { url: string; error: string }[];
  skipped: { url: string; reason: string }[];
  unmappedCategories: Record<string, string[]>;
  fieldCoverage: Record<string, number>;
};

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const limitArg = args.indexOf("--limit");
  const limit = limitArg >= 0 ? Number(args[limitArg + 1]) : Infinity;

  loadLocalSupabaseEnv();
  const db = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  const fetcher = new PoliteFetcher({ userAgent: USER_AGENT });
  const report: Report = {
    startedAt: new Date().toISOString(),
    dryRun,
    discovered: 0,
    succeeded: 0,
    created: 0,
    updated: 0,
    geocoded: 0,
    failed: [],
    skipped: [],
    unmappedCategories: {},
    fieldCoverage: { address: 0, coordinates: 0, phone: 0, website: 0, description: 0 },
  };

  // 1. Discover listings. Abort before touching the database if this fails.
  let urls: string[];
  try {
    urls = parseSitemap(await fetcher.getText(`${ORIGIN}/job_listing-sitemap.xml`)).map(normalizeUrl);
  } catch (err) {
    console.error(`Could not fetch the source sitemap; nothing was changed. ${(err as Error).message}`);
    process.exit(1);
  }
  if (urls.length === 0) {
    console.error("Source sitemap listed no listings; nothing was changed.");
    process.exit(1);
  }
  urls = urls.slice(0, limit);
  report.discovered = urls.length;
  log(`Discovered ${urls.length} listings`);

  // 2. Source taxonomy and per-category membership (listing pages don't show categories).
  const taxonomy = await fetchTaxonomy(fetcher);
  log(`Fetched ${taxonomy.length} source categories; resolving membership…`);
  const categoriesByUrl = new Map<string, string[]>();
  for (const term of taxonomy) {
    for (const url of await listingsInCategory(fetcher, term.id)) {
      categoriesByUrl.set(url, [...(categoriesByUrl.get(url) ?? []), term.slug]);
    }
  }

  const [sourceMap, categoryIds] = await Promise.all([loadSourceCategoryMap(db), loadCategoryIds(db)]);
  // Nominatim (used without a MapTiler key) also needs ≤1 req/s.
  const geocodeThrottled = throttle((q: string) => geocode(q, { userAgent: USER_AGENT }), 1100);

  // 3. Fetch, parse, map, and upsert each listing.
  mkdirSync(path.join(CACHE_DIR, "pages"), { recursive: true });
  for (const [i, url] of urls.entries()) {
    try {
      const html = await fetcher.getText(url);
      writeFileSync(path.join(CACHE_DIR, "pages", `${slugOf(url)}.html`), html);
      const listing = parseListing(html, url);
      for (const k of ["address", "phone", "website", "description"] as const) if (listing[k]) report.fieldCoverage[k]++;
      if (listing.lat !== null) report.fieldCoverage.coordinates++;

      const { categories, unmapped } = mapCategories(categoriesByUrl.get(url) ?? [], taxonomy, sourceMap);
      for (const s of unmapped) (report.unmappedCategories[s] ??= []).push(url);

      const built = await buildRecord(listing, categories, geocodeThrottled);
      if (!built.ok) {
        report.skipped.push({ url, reason: built.reason });
        log(`[${i + 1}/${urls.length}] skip ${slugOf(url)}: ${built.reason}`);
        continue;
      }
      if (built.geocoded) report.geocoded++;
      if (!dryRun) report[await upsertBusiness(db, built.record, categoryIds)]++;
      report.succeeded++;
      log(`[${i + 1}/${urls.length}] ok   ${slugOf(url)} → ${categories.join(", ")}`);
    } catch (err) {
      report.failed.push({ url, error: (err as Error).message });
      log(`[${i + 1}/${urls.length}] FAIL ${slugOf(url)}: ${(err as Error).message}`);
    }
  }

  const reportPath = path.join(CACHE_DIR, `import-report-${report.startedAt.replace(/[:.]/g, "-")}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(
    `\n${dryRun ? "DRY RUN — no changes written.\n" : ""}` +
      `Discovered ${report.discovered}, succeeded ${report.succeeded} (created ${report.created}, updated ${report.updated}, geocoded ${report.geocoded}), ` +
      `skipped ${report.skipped.length}, failed ${report.failed.length}, unmapped categories ${Object.keys(report.unmappedCategories).length}.\n` +
      `Field coverage: ${Object.entries(report.fieldCoverage).map(([k, v]) => `${k} ${v}/${report.discovered}`).join(", ")}\n` +
      `Report: ${reportPath}`,
  );
  if (report.failed.length) process.exitCode = 2;
}

async function fetchTaxonomy(fetcher: PoliteFetcher): Promise<SourceCategory[]> {
  const terms: SourceCategory[] = [];
  for (let page = 1; ; page++) {
    const batch = JSON.parse(
      await fetcher.getText(`${ORIGIN}/wp-json/wp/v2/job-categories?per_page=100&page=${page}&_fields=id,slug,name,parent`),
    ) as SourceCategory[];
    terms.push(...batch);
    if (batch.length < 100) return terms;
  }
}

async function listingsInCategory(fetcher: PoliteFetcher, termId: number): Promise<string[]> {
  const urls: string[] = [];
  for (let page = 1; ; page++) {
    const body = new URLSearchParams({ "search_categories[]": String(termId), per_page: "100", page: String(page) });
    const res = parseGetListings(
      await fetcher.getText(`${ORIGIN}/jm-ajax/get_listings/`, {
        method: "POST",
        body,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }),
    );
    urls.push(...res.urls);
    if (page >= res.maxPages) return urls;
  }
}

function throttle<A, R>(fn: (a: A) => Promise<R>, ms: number): (a: A) => Promise<R> {
  let last = 0;
  return async (a) => {
    const wait = last + ms - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    last = Date.now();
    return fn(a);
  };
}

const slugOf = (url: string) => new URL(url).pathname.split("/").filter(Boolean).pop()!;
const log = (msg: string) => console.log(msg);

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
