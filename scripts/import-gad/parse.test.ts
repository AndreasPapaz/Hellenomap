import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseAddressParts, parseGetListings, parseListing, parseSitemap } from "./parse";

const fixture = (name: string) => readFileSync(path.join(__dirname, "fixtures", name), "utf8");
const url = (slug: string) => `https://greekamericandirectory.com/listing/${slug}/`;

describe("parseSitemap", () => {
  it("returns every listing URL", () => {
    const urls = parseSitemap(fixture("job_listing-sitemap.xml"));
    expect(urls.length).toBe(125);
    expect(urls).toContain(url("agora-market"));
    expect(urls.every((u) => u.includes("/listing/"))).toBe(true);
  });
});

describe("parseListing", () => {
  it("extracts a complete listing", () => {
    const l = parseListing(fixture("agora-market.html"), url("agora-market"));
    expect(l).toMatchObject({
      sourceUrl: url("agora-market"),
      name: "Agora Market",
      address: "2134 N Western Ave, Chicago, IL 60647",
      lat: 41.9210658,
      lng: -87.6880319,
      phone: "(773) 904-3000",
      website: "https://www.agoramarketchicago.com/",
    });
    expect(l.description).toMatch(/^AGORA: A GATHERING PLACE/);
  });

  it("handles a listing without a website", () => {
    const l = parseListing(fixture("le-french-patisserie.html"), url("le-french-patisserie"));
    expect(l.website).toBeNull();
    expect(l.lat).not.toBeNull();
    expect(l.description).toContain("French pastries");
  });

  it("returns null coordinates when the map options lack them", () => {
    const l = parseListing(fixture("ariston-restaurant.html"), url("ariston-restaurant"));
    expect(l.address).toBe("919 Mannheim Rd, Bellwood, IL 60104");
    expect(l.lat).toBeNull();
    expect(l.lng).toBeNull();
  });

  it("returns null address and coordinates when the listing has neither", () => {
    const l = parseListing(fixture("yd-marketing.html"), url("yd-marketing"));
    expect(l.name).toBeTruthy();
    expect(l.address).toBeNull();
    expect(l.lat).toBeNull();
  });
});

describe("parseGetListings", () => {
  it("extracts listing URLs from a WP Job Manager response", () => {
    const { urls, maxPages } = parseGetListings(fixture("get-listings-lawyer.json"));
    expect(maxPages).toBe(1);
    expect(urls.sort()).toEqual(
      ["gasparis-zembillas-attorneys-at-law", "katris-law-group", "reveliotis-law-p-c", "ted-diamantopoulos-attorney-at-law"].map(url),
    );
  });
});

describe("parseAddressParts", () => {
  it.each([
    ["2134 N Western Ave, Chicago, IL 60647", "IL", "60647"],
    ["315 South Halsted Street, Chicago, Illinois", "IL", null],
    ["807 W. Webster, Chicago Il 60614", "IL", "60614"],
    ["262 Rivervale Road Rivervale, NJ 07675", "NJ", "07675"],
    ["Pontian Greek Society of Chicago P.O. Box 6127 Bloomingdale, IL 60108-6127", "IL", "60108"],
  ])("%s", (address, region, postalCode) => {
    expect(parseAddressParts(address)).toEqual({ region, postalCode });
  });
});
