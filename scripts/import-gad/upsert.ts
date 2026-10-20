import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../src/lib/supabase/database.types";
import { uniqueSlug } from "../../src/lib/unique-slug";
import type { GeocodeResult } from "../../src/lib/geocode";
import { parseAddressParts, type SourceListing } from "./parse";

type Db = SupabaseClient<Database>;

export type ImportRecord = {
  sourceUrl: string;
  name: string;
  description: string | null;
  address: string;
  region: string | null;
  postalCode: string | null;
  phone: string | null;
  website: string | null;
  lat: number;
  lng: number;
  categories: string[]; // our slugs, primary first
};

export type BuildResult =
  | { ok: true; record: ImportRecord; geocoded: boolean }
  | { ok: false; reason: string };

/** Turns a parsed listing into an import record, geocoding the address when coordinates are missing. */
export async function buildRecord(
  listing: SourceListing,
  categories: string[],
  geocode: (q: string) => Promise<GeocodeResult | null>,
): Promise<BuildResult> {
  if (!listing.address && listing.lat === null) return { ok: false, reason: "no address or coordinates" };

  let { lat, lng } = listing;
  let geocoded = false;
  if (lat === null || lng === null) {
    let hit: GeocodeResult | null = null;
    try {
      hit = await geocode(listing.address!);
    } catch (err) {
      return { ok: false, reason: `geocoding failed: ${(err as Error).message}` };
    }
    if (!hit) return { ok: false, reason: `address could not be geocoded: ${listing.address}` };
    ({ lat, lng } = hit);
    geocoded = true;
  }

  const address = listing.address ?? "";
  const { region, postalCode } = parseAddressParts(address);
  return {
    ok: true,
    geocoded,
    record: {
      sourceUrl: listing.sourceUrl,
      name: listing.name,
      description: listing.description,
      address,
      region,
      postalCode,
      phone: listing.phone,
      website: listing.website,
      lat: lat!,
      lng: lng!,
      categories,
    },
  };
}

export type UpsertOutcome = "created" | "updated";

/**
 * Inserts or updates an imported business, matched by source URL.
 * Existing rows keep any field listed in `owner_edited_fields` and their status/published flags.
 */
export async function upsertBusiness(db: Db, rec: ImportRecord, categoryIds: Map<string, number>): Promise<UpsertOutcome> {
  const { data: existing, error: selErr } = await db
    .from("businesses")
    .select("id, owner_edited_fields")
    .eq("source_url", rec.sourceUrl)
    .maybeSingle();
  if (selErr) throw selErr;

  const fields = {
    name: rec.name,
    description: rec.description,
    address: rec.address,
    region: rec.region,
    postal_code: rec.postalCode,
    phone: rec.phone,
    website: rec.website,
    location: `SRID=4326;POINT(${rec.lng} ${rec.lat})`,
  };

  let id: string;
  let outcome: UpsertOutcome;
  let editable = true;
  if (existing) {
    const locked = new Set(existing.owner_edited_fields);
    const update: Partial<typeof fields> = Object.fromEntries(Object.entries(fields).filter(([k]) => !locked.has(k)));
    if (Object.keys(update).length) {
      const { error } = await db.from("businesses").update(update).eq("id", existing.id);
      if (error) throw error;
    }
    id = existing.id;
    outcome = "updated";
    editable = !locked.has("categories");
  } else {
    const { data, error } = await db
      .from("businesses")
      .insert({
        ...fields,
        slug: await uniqueSlug(db, rec.name),
        origin: "import",
        source_url: rec.sourceUrl,
        status: "approved",
        published: true,
      })
      .select("id")
      .single();
    if (error) throw error;
    id = data.id;
    outcome = "created";
  }

  if (editable) await replaceCategories(db, id, rec.categories, categoryIds);
  return outcome;
}

async function replaceCategories(db: Db, businessId: string, slugs: string[], categoryIds: Map<string, number>) {
  const rows = slugs.map((slug, i) => {
    const categoryId = categoryIds.get(slug);
    if (categoryId === undefined) throw new Error(`unknown category slug: ${slug}`);
    return { business_id: businessId, category_id: categoryId, is_primary: i === 0 };
  });
  const del = await db.from("business_categories").delete().eq("business_id", businessId);
  if (del.error) throw del.error;
  const ins = await db.from("business_categories").insert(rows);
  if (ins.error) throw ins.error;
}

export async function loadCategoryIds(db: Db): Promise<Map<string, number>> {
  const { data, error } = await db.from("categories").select("id, slug");
  if (error) throw error;
  return new Map(data.map((c) => [c.slug, c.id]));
}

export async function loadSourceCategoryMap(db: Db): Promise<Map<string, string>> {
  const { data, error } = await db.from("source_category_map").select("source_slug, categories(slug)");
  if (error) throw error;
  return new Map(data.map((r) => [r.source_slug, r.categories!.slug]));
}
