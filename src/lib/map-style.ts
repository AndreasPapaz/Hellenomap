// Vector basemap. MapTiler when a key is configured; otherwise OpenFreeMap (free, no key).
export function mapStyleUrl(): string {
  const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;
  return key
    ? `https://api.maptiler.com/maps/streets-v2/style.json?key=${key}`
    : "https://tiles.openfreemap.org/styles/liberty";
}

export const BRAND_BLUE = "#0d5eaf";
