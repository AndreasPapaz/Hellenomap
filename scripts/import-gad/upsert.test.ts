import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "../../src/lib/supabase/database.types";
import { buildRecord, loadCategoryIds, upsertBusiness, type ImportRecord } from "./upsert";
import type { SourceListing } from "./parse";

const listing = (over: Partial<SourceListing> = {}): SourceListing => ({
  sourceUrl: "https://greekamericandirectory.com/listing/test-x/",
  name: "Test X",
  address: "1 Main St, Chicago, IL 60601",
  lat: 41.88,
  lng: -87.63,
  phone: null,
  website: null,
  description: null,
  ...over,
});

describe("buildRecord", () => {
  const never = async () => {
    throw new Error("should not geocode");
  };

  it("uses source coordinates when present", async () => {
    const r = await buildRecord(listing(), ["deli"], never);
    expect(r).toMatchObject({ ok: true, geocoded: false, record: { lat: 41.88, lng: -87.63, region: "IL", postalCode: "60601" } });
  });

  it("geocodes the address when coordinates are missing", async () => {
    const r = await buildRecord(listing({ lat: null, lng: null }), ["deli"], async () => ({ lat: 1, lng: 2, label: "x" }));
    expect(r).toMatchObject({ ok: true, geocoded: true, record: { lat: 1, lng: 2 } });
  });

  it("skips when geocoding finds nothing", async () => {
    const r = await buildRecord(listing({ lat: null, lng: null }), ["deli"], async () => null);
    expect(r).toEqual({ ok: false, reason: expect.stringContaining("could not be geocoded") });
  });

  it("skips when geocoding errors", async () => {
    const r = await buildRecord(listing({ lat: null, lng: null }), ["deli"], async () => {
      throw new Error("boom");
    });
    expect(r).toEqual({ ok: false, reason: "geocoding failed: boom" });
  });

  it("skips listings with neither address nor coordinates", async () => {
    const r = await buildRecord(listing({ address: null, lat: null, lng: null }), ["deli"], never);
    expect(r).toEqual({ ok: false, reason: "no address or coordinates" });
  });
});

describe.skipIf(!process.env.HAS_LOCAL_SUPABASE)("upsertBusiness (local Supabase)", () => {
  const db = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  const sourceUrl = "https://greekamericandirectory.com/listing/__upsert-test__/";
  const rec: ImportRecord = {
    sourceUrl,
    name: "Upsert Test Deli",
    description: "d",
    address: "1 Main St, Chicago, IL 60601",
    region: "IL",
    postalCode: "60601",
    phone: "(312) 555-0100",
    website: null,
    lat: 41.88,
    lng: -87.63,
    categories: ["deli", "market"],
  };
  let categoryIds: Map<string, number>;
  const cleanup = () => db.from("businesses").delete().eq("source_url", sourceUrl);

  beforeAll(async () => {
    await cleanup();
    categoryIds = await loadCategoryIds(db);
  });
  afterAll(async () => {
    await cleanup();
  });

  const count = async () =>
    (await db.from("businesses").select("id", { count: "exact", head: true }).eq("source_url", sourceUrl)).count;

  it("creates an approved, published import with categories", async () => {
    expect(await upsertBusiness(db, rec, categoryIds)).toBe("created");
    const { data } = await db
      .from("businesses")
      .select("status, published, origin, slug, business_categories(is_primary, categories(slug))")
      .eq("source_url", sourceUrl)
      .single();
    expect(data).toMatchObject({ status: "approved", published: true, origin: "import", slug: "upsert-test-deli" });
    const primary = data!.business_categories.find((c) => c.is_primary)?.categories?.slug;
    expect(primary).toBe("deli");
    expect(data!.business_categories).toHaveLength(2);
  });

  it("does not duplicate on re-run", async () => {
    expect(await upsertBusiness(db, rec, categoryIds)).toBe("updated");
    expect(await count()).toBe(1);
  });

  it("keeps owner-edited fields and unpublished state", async () => {
    await db
      .from("businesses")
      .update({ name: "Owner Name", published: false, owner_edited_fields: ["name", "categories"] })
      .eq("source_url", sourceUrl);

    await upsertBusiness(db, { ...rec, phone: "(312) 555-0199", categories: ["restaurant"] }, categoryIds);

    const { data } = await db
      .from("businesses")
      .select("name, phone, published, business_categories(categories(slug))")
      .eq("source_url", sourceUrl)
      .single();
    expect(data).toMatchObject({ name: "Owner Name", phone: "(312) 555-0199", published: false });
    expect(data!.business_categories.map((c) => c.categories?.slug).sort()).toEqual(["deli", "market"]);
    expect(await count()).toBe(1);
  });
});
