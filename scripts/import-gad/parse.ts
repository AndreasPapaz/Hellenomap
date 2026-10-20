// HTML/JSON parsers for greekamericandirectory.com (WordPress + Lestin theme + WP Job Manager).
// All selectors for the source site live in this file.
import * as cheerio from "cheerio";

export type SourceListing = {
  sourceUrl: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  website: string | null;
  description: string | null;
};

export type SourceCategory = { id: number; slug: string; name: string; parent: number };

const MAX_DESCRIPTION = 2000;

export function parseSitemap(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)]
    .map((m) => m[1])
    .filter((u) => /\/listing\/[^/]+\/?$/.test(u));
}

export function parseListing(html: string, sourceUrl: string): SourceListing {
  const $ = cheerio.load(html);
  const text = (sel: string) => $(sel).first().text().replace(/\s+/g, " ").trim() || null;

  const name = text(".lestin-post-title .post-title") ?? text("h1");
  if (!name) throw new Error("listing has no name");

  const website = $(".lt-info-website a[href^='http']").first().attr("href")?.trim() || null;
  const phone = text(".lt-info-phone .info-value");

  const description = $(".post-content")
    .first()
    .find("p")
    .map((_, p) => $(p).text().replace(/\s+/g, " ").trim())
    .get()
    .filter(Boolean)
    .join("\n\n");

  const { lat, lng } = parseCoordinates(html);

  return {
    sourceUrl,
    name,
    address: text(".lt-info-address .info-value"),
    lat,
    lng,
    phone,
    website,
    description: description ? description.slice(0, MAX_DESCRIPTION) : null,
  };
}

// Coordinates are only present in the inline `lestin_map_options` script.
function parseCoordinates(html: string): { lat: number | null; lng: number | null } {
  const opts = html.match(/lestin_map_options\s*=\s*(\{.*?\});/s)?.[1];
  if (!opts) return { lat: null, lng: null };
  try {
    const { latitude, longitude } = JSON.parse(opts) as { latitude?: string; longitude?: string };
    const lat = Number.parseFloat(latitude ?? "");
    const lng = Number.parseFloat(longitude ?? "");
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return { lat: null, lng: null };
    }
    return { lat, lng };
  } catch {
    return { lat: null, lng: null };
  }
}

/** Listing URLs from a WP Job Manager `/jm-ajax/get_listings/` JSON response. */
export function parseGetListings(json: string): { urls: string[]; maxPages: number } {
  const data = JSON.parse(json) as { html?: string; max_num_pages?: number };
  const $ = cheerio.load(data.html ?? "");
  const urls = new Set<string>();
  $("a[href*='/listing/']").each((_, a) => {
    const href = $(a).attr("href");
    if (href && /\/listing\/[^/]+\/?$/.test(href)) urls.add(normalizeUrl(href));
  });
  return { urls: [...urls], maxPages: data.max_num_pages ?? 1 };
}

export function normalizeUrl(url: string): string {
  const u = new URL(url);
  return `${u.origin}${u.pathname.replace(/\/?$/, "/")}`;
}

const US_STATES: Record<string, string> = {
  illinois: "IL", "new jersey": "NJ", "new york": "NY", indiana: "IN", wisconsin: "WI", michigan: "MI",
};

/** Best-effort split of a free-text US address. Unknown parts are null. */
export function parseAddressParts(address: string): { region: string | null; postalCode: string | null } {
  const postalCode = address.match(/\b(\d{5})(?:-\d{4})?\b(?!.*\b\d{5}\b)/)?.[1] ?? null;
  const abbr = address.match(/(?:,|\s)([A-Z]{2})(?:,|\s+\d{5}|\s*$)/)?.[1];
  if (abbr && abbr !== "US") return { region: abbr, postalCode };
  const lower = address.toLowerCase();
  const named = Object.keys(US_STATES).find((s) => lower.includes(s));
  if (named) return { region: US_STATES[named], postalCode };
  const il = address.match(/\bIl\b/);
  return { region: il ? "IL" : null, postalCode };
}
