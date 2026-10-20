import { describe, expect, it } from "vitest";
import { geocode } from "@/lib/geocode";

const respond = (body: unknown, status = 200) =>
  (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe("geocode", () => {
  it("uses MapTiler when a key is given", async () => {
    const calls: string[] = [];
    const fetchImpl = (async (url: string) => {
      calls.push(url);
      return new Response(JSON.stringify({ features: [{ center: [-87.9, 41.88], place_name: "Bellwood, IL" }] }));
    }) as unknown as typeof fetch;
    await expect(geocode("919 Mannheim Rd, Bellwood, IL", { key: "k", fetchImpl })).resolves.toEqual({
      lat: 41.88,
      lng: -87.9,
      label: "Bellwood, IL",
    });
    expect(calls[0]).toContain("api.maptiler.com/geocoding/919%20Mannheim");
  });

  it("returns null when nothing matches", async () => {
    await expect(geocode("zzzz", { key: "k", fetchImpl: respond({ features: [] }) })).resolves.toBeNull();
  });

  it("falls back to Nominatim without a key", async () => {
    const fetchImpl = respond([{ lat: "40.77", lon: "-73.92", display_name: "Astoria" }]);
    await expect(geocode("Astoria, NY", { key: "", fetchImpl })).resolves.toEqual({
      lat: 40.77,
      lng: -73.92,
      label: "Astoria",
    });
  });

  it("returns null for blank input without calling the API", async () => {
    await expect(geocode("  ", { key: "k", fetchImpl: respond({}, 500) })).resolves.toBeNull();
  });

  it("throws on provider errors so callers can decide", async () => {
    await expect(geocode("x", { key: "k", fetchImpl: respond({}, 500) })).rejects.toThrow("500");
  });
});
