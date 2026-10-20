import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { mapCategories } from "./categories";
import type { SourceCategory } from "./parse";

const taxonomy = JSON.parse(
  readFileSync(path.join(__dirname, "fixtures", "job-categories.json"), "utf8"),
) as SourceCategory[];

const sourceMap = new Map([
  ["deli", "deli"],
  ["market", "market"],
  ["food-markets-specialty-shops", "market"],
  ["restaurant", "restaurant"],
  ["lunch", "lunch"],
  ["dinner", "dinner"],
  ["restaurants-dining", "restaurant"],
  ["lawyer", "lawyer"],
  ["professional-services", "professional-services-other"],
]);

describe("mapCategories", () => {
  it("maps a known source category", () => {
    expect(mapCategories(["deli"], taxonomy, sourceMap)).toEqual({ categories: ["deli"], unmapped: [] });
  });

  it("drops the parent tag when a child of it is present", () => {
    expect(mapCategories(["food-markets-specialty-shops", "deli"], taxonomy, sourceMap).categories).toEqual(["deli"]);
  });

  it("keeps a parent-only tag via its mapping", () => {
    expect(mapCategories(["professional-services"], taxonomy, sourceMap).categories).toEqual([
      "professional-services-other",
    ]);
  });

  it("puts meal-time tags after the specific category", () => {
    expect(mapCategories(["lunch", "dinner", "restaurant", "restaurants-dining"], taxonomy, sourceMap).categories).toEqual([
      "restaurant",
      "lunch",
      "dinner",
    ]);
  });

  it("assigns unmapped categories to Other and reports them", () => {
    expect(mapCategories(["brand-new-thing", "lawyer"], taxonomy, sourceMap)).toEqual({
      categories: ["lawyer", "other"],
      unmapped: ["brand-new-thing"],
    });
  });

  it("falls back to Other when the listing has no categories", () => {
    expect(mapCategories([], taxonomy, sourceMap)).toEqual({ categories: ["other"], unmapped: [] });
  });
});
