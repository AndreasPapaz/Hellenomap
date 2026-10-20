import { describe, expect, it } from "vitest";
import { parsePoint, toBusinessDetail, toTaxonomy } from "@/lib/directory";

describe("parsePoint", () => {
  it("decodes PostgREST EWKB hex", () => {
    const p = parsePoint("0101000020E6100000B446F3B608EC55C0673BF07BE5F54440");
    expect(p!.lng).toBeCloseTo(-87.6880319, 6);
    expect(p!.lat).toBeCloseTo(41.9210658, 6);
  });

  it("accepts GeoJSON", () => {
    expect(parsePoint({ type: "Point", coordinates: [-87.6, 41.9] })).toEqual({ lat: 41.9, lng: -87.6 });
  });

  it("returns null for missing locations", () => {
    expect(parsePoint(null)).toBeNull();
  });
});

describe("toBusinessDetail", () => {
  it("orders the primary category first", () => {
    const d = toBusinessDetail({
      slug: "s",
      name: "N",
      description: null,
      address: "A",
      phone: null,
      website: null,
      origin: "import",
      source_url: "https://example.com/listing/s/",
      location: { coordinates: [1, 2] },
      business_categories: [
        { is_primary: false, categories: { slug: "lunch", name: "Lunch" } },
        { is_primary: true, categories: { slug: "restaurant", name: "Restaurant" } },
      ],
    });
    expect(d!.categories.map((c) => c.slug)).toEqual(["restaurant", "lunch"]);
  });
});

describe("toTaxonomy", () => {
  it("sorts categories within a group", () => {
    expect(
      toTaxonomy([
        { slug: "g", name: "G", categories: [{ slug: "other", name: "Other", sort: 2 }, { slug: "a", name: "A", sort: 0 }] },
      ]),
    ).toEqual([{ slug: "g", name: "G", categories: [{ slug: "a", name: "A" }, { slug: "other", name: "Other" }] }]);
  });
});
