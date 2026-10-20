// Map view state <-> URL query params, so filtered views are shareable.
//   ?lat=41.88&lng=-87.63&z=11&cat=lawyer,deli&group=food-dining&q=Astoria%2C%20NY&ref=41.9,-87.6&b=agora-market

export type LngLat = { lat: number; lng: number };

export type MapState = {
  center: LngLat;
  zoom: number;
  categories: string[];
  groups: string[];
  /** Text of the last location search, if any. */
  query: string | null;
  /** Reference point for distances: the user's location or the searched place. Null → map center. */
  ref: LngLat | null;
  /** Slug of the selected business. */
  selected: string | null;
};

// Chicago: where the seed data lives.
export const DEFAULT_STATE: MapState = {
  center: { lat: 41.8781, lng: -87.6298 },
  zoom: 10,
  categories: [],
  groups: [],
  query: null,
  ref: null,
  selected: null,
};

const num = (v: string | null, min: number, max: number) => {
  if (v === null || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};

const list = (v: string | null) =>
  (v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[a-z0-9-]+$/.test(s));

export function parseMapState(params: URLSearchParams): MapState {
  const lat = num(params.get("lat"), -90, 90);
  const lng = num(params.get("lng"), -180, 180);
  const [rlat, rlng] = (params.get("ref") ?? "").split(",");
  const refLat = num(rlat ?? null, -90, 90);
  const refLng = num(rlng ?? null, -180, 180);
  const selected = params.get("b");
  return {
    center: lat !== null && lng !== null ? { lat, lng } : DEFAULT_STATE.center,
    zoom: num(params.get("z"), 0, 22) ?? DEFAULT_STATE.zoom,
    categories: list(params.get("cat")),
    groups: list(params.get("group")),
    query: params.get("q")?.slice(0, 200) || null,
    ref: refLat !== null && refLng !== null ? { lat: refLat, lng: refLng } : null,
    selected: selected && /^[a-z0-9-]+$/.test(selected) ? selected : null,
  };
}

const round = (n: number, digits: number) => Number(n.toFixed(digits)).toString();

export function serializeMapState(s: MapState): URLSearchParams {
  const p = new URLSearchParams();
  p.set("lat", round(s.center.lat, 5));
  p.set("lng", round(s.center.lng, 5));
  p.set("z", round(s.zoom, 2));
  if (s.categories.length) p.set("cat", s.categories.join(","));
  if (s.groups.length) p.set("group", s.groups.join(","));
  if (s.query) p.set("q", s.query);
  if (s.ref) p.set("ref", `${round(s.ref.lat, 4)},${round(s.ref.lng, 4)}`);
  if (s.selected) p.set("b", s.selected);
  return p;
}

const METERS_PER_MILE = 1609.344;

export function formatDistance(meters: number): string {
  const miles = meters / METERS_PER_MILE;
  if (miles < 0.1) return `${Math.round(meters * 3.28084)} ft`;
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}
