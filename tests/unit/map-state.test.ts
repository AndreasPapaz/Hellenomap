import { describe, expect, it } from "vitest";
import { DEFAULT_STATE, formatDistance, parseMapState, serializeMapState } from "@/lib/map-state";

describe("map state URL", () => {
  it("round-trips a filtered view", () => {
    const state = {
      center: { lat: 41.92107, lng: -87.68803 },
      zoom: 12.5,
      categories: ["lawyer"],
      groups: ["food-dining"],
      query: "Chicago, IL",
      ref: { lat: 41.9, lng: -87.6 },
      selected: "agora-market",
    };
    expect(parseMapState(serializeMapState(state))).toEqual(state);
  });

  it("falls back to defaults for missing or invalid values", () => {
    expect(parseMapState(new URLSearchParams("lat=999&lng=abc&z=-4&cat=<script>,ok&b=../x"))).toEqual({
      ...DEFAULT_STATE,
      categories: ["ok"],
    });
  });

  it("ignores a partial reference point", () => {
    expect(parseMapState(new URLSearchParams("ref=41.9")).ref).toBeNull();
  });
});

describe("formatDistance", () => {
  it.each([
    [30, "98 ft"],
    [804.672, "0.5 mi"],
    [4828.032, "3.0 mi"],
    [19312.128, "12 mi"],
  ])("%d m → %s", (m, s) => expect(formatDistance(m)).toBe(s));
});
