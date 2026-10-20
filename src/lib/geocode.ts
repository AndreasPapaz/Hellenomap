// Forward geocoding. Uses MapTiler when MAPTILER_KEY / NEXT_PUBLIC_MAPTILER_KEY is set;
// otherwise falls back to OpenStreetMap Nominatim, which is only suitable for local
// development and the low-volume import (max 1 req/s, identifying User-Agent required).

export type GeocodeResult = { lat: number; lng: number; label: string };

export type GeocodeOptions = {
  key?: string;
  fetchImpl?: typeof fetch;
  userAgent?: string;
};

export async function geocode(query: string, opts: GeocodeOptions = {}): Promise<GeocodeResult | null> {
  const q = query.trim();
  if (!q) return null;
  const key = opts.key ?? process.env.MAPTILER_KEY ?? process.env.NEXT_PUBLIC_MAPTILER_KEY;
  const fetchImpl = opts.fetchImpl ?? fetch;
  return key ? maptiler(q, key, fetchImpl) : nominatim(q, fetchImpl, opts.userAgent ?? "Hellenomap/1.0");
}

async function maptiler(q: string, key: string, fetchImpl: typeof fetch): Promise<GeocodeResult | null> {
  const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(q)}.json?key=${key}&limit=1`;
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`MapTiler geocoding failed: ${res.status}`);
  const data = (await res.json()) as { features?: { center: [number, number]; place_name: string }[] };
  const f = data.features?.[0];
  return f ? { lng: f.center[0], lat: f.center[1], label: f.place_name } : null;
}

async function nominatim(q: string, fetchImpl: typeof fetch, userAgent: string): Promise<GeocodeResult | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`;
  const res = await fetchImpl(url, { headers: { "User-Agent": userAgent } });
  if (!res.ok) throw new Error(`Nominatim geocoding failed: ${res.status}`);
  const data = (await res.json()) as { lat: string; lon: string; display_name: string }[];
  const f = data[0];
  return f ? { lat: Number(f.lat), lng: Number(f.lon), label: f.display_name } : null;
}

/**
 * Autocomplete suggestions. Only available with MapTiler — Nominatim's usage policy forbids
 * autocomplete, so without a key this returns no suggestions and users submit the full query.
 */
export async function suggest(query: string, opts: GeocodeOptions = {}): Promise<GeocodeResult[]> {
  const q = query.trim();
  const key = opts.key ?? process.env.MAPTILER_KEY ?? process.env.NEXT_PUBLIC_MAPTILER_KEY;
  if (!q || !key) return [];
  const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(q)}.json?key=${key}&limit=5&autocomplete=true`;
  const res = await (opts.fetchImpl ?? fetch)(url);
  if (!res.ok) throw new Error(`MapTiler geocoding failed: ${res.status}`);
  const data = (await res.json()) as { features?: { center: [number, number]; place_name: string }[] };
  return (data.features ?? []).map((f) => ({ lng: f.center[0], lat: f.center[1], label: f.place_name }));
}
