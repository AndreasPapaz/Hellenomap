import type { Database } from "./supabase/database.types";

export type BusinessInView = Database["public"]["Functions"]["businesses_in_view"]["Returns"][number];

export type TaxonomyCategory = { slug: string; name: string };
export type TaxonomyGroup = { slug: string; name: string; categories: TaxonomyCategory[] };
export type Taxonomy = TaxonomyGroup[];

type GroupRow = { slug: string; name: string; categories: { slug: string; name: string; sort: number }[] };

export function toTaxonomy(rows: GroupRow[]): Taxonomy {
  return rows.map((g) => ({
    slug: g.slug,
    name: g.name,
    categories: [...g.categories]
      .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name))
      .map(({ slug, name }) => ({ slug, name })),
  }));
}

export type BusinessDetailData = {
  slug: string;
  name: string;
  description: string | null;
  address: string;
  phone: string | null;
  website: string | null;
  origin: "import" | "submission";
  sourceUrl: string | null;
  lat: number;
  lng: number;
  categories: { slug: string; name: string; primary: boolean }[];
};

type DetailRow = {
  slug: string;
  name: string;
  description: string | null;
  address: string;
  phone: string | null;
  website: string | null;
  origin: "import" | "submission";
  source_url: string | null;
  location: unknown;
  business_categories: { is_primary: boolean; categories: { slug: string; name: string } | null }[];
};

export const DETAIL_SELECT =
  "slug, name, description, address, phone, website, origin, source_url, location, business_categories(is_primary, categories(slug, name))";

/** PostgREST returns geography as GeoJSON or EWKB hex depending on context; accept both. */
export function parsePoint(location: unknown): { lat: number; lng: number } | null {
  if (location && typeof location === "object" && "coordinates" in location) {
    const [lng, lat] = (location as { coordinates: [number, number] }).coordinates;
    return { lat, lng };
  }
  if (typeof location === "string" && /^[0-9a-f]+$/i.test(location) && location.length >= 42) {
    // EWKB point: byte order, uint32 type (with SRID flag), [uint32 srid], float64 x, float64 y
    const bytes = new Uint8Array(location.match(/../g)!.map((h) => parseInt(h, 16)));
    const view = new DataView(bytes.buffer);
    const le = bytes[0] === 1;
    const type = view.getUint32(1, le);
    const offset = type & 0x20000000 ? 9 : 5;
    return { lng: view.getFloat64(offset, le), lat: view.getFloat64(offset + 8, le) };
  }
  return null;
}

export function toBusinessDetail(row: DetailRow): BusinessDetailData | null {
  const point = parsePoint(row.location);
  if (!point) return null;
  return {
    slug: row.slug,
    name: row.name,
    description: row.description,
    address: row.address,
    phone: row.phone,
    website: row.website,
    origin: row.origin,
    sourceUrl: row.source_url,
    ...point,
    categories: row.business_categories
      .filter((c) => c.categories)
      .map((c) => ({ ...c.categories!, primary: c.is_primary }))
      .sort((a, b) => Number(b.primary) - Number(a.primary)),
  };
}
