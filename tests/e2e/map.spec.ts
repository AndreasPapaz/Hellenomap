import { expect, test, type Page } from "@playwright/test";
import { ASTORIA, cleanup, seed } from "./support";

test.beforeAll(seed);
test.afterAll(cleanup);

const astoriaUrl = (extra = "") => `/?lat=${ASTORIA.lat}&lng=${ASTORIA.lng}&z=14${extra}`;

async function waitForMap(page: Page) {
  await page.waitForFunction(() => {
    const m = (window as unknown as { __map?: { loaded(): boolean; getLayer(id: string): unknown } }).__map;
    return !!m && !!m.getLayer("points");
  });
}

const resultSlugs = (page: Page) => page.getByTestId("result-item").evaluateAll((els) => els.map((e) => e.getAttribute("data-slug")));

test("shows approved businesses in view, nearest first, and never pending ones", async ({ page }) => {
  await page.goto(astoriaUrl());
  await waitForMap(page);
  await expect
    .poll(() => resultSlugs(page))
    .toEqual(expect.arrayContaining(["e2e-taverna", "e2e-bakery", "e2e-lawyer", "e2e-cpa"]));
  const slugs = await resultSlugs(page);
  expect(slugs).not.toContain("e2e-pending");
  expect(slugs[0]).toBe("e2e-taverna"); // closest to the map center
});

test("panning updates results and shows the empty state", async ({ page }) => {
  await page.goto(astoriaUrl());
  await waitForMap(page);
  await expect(page.getByTestId("result-item").first()).toBeVisible();
  await page.evaluate(() => (window as unknown as { __map: { jumpTo(o: object): void } }).__map.jumpTo({ center: [-40, 35] }));
  await expect(page.getByTestId("results-empty")).toBeVisible();
  await expect(page.getByTestId("results-empty").getByRole("link", { name: "Submit a business" })).toBeVisible();
});

test("clicking a cluster zooms in", async ({ page }) => {
  await page.goto(`/?lat=${ASTORIA.lat}&lng=${ASTORIA.lng}&z=11`);
  await waitForMap(page);
  const cluster = await page.waitForFunction(() => {
    type M = { queryRenderedFeatures(o: object): { geometry: { coordinates: [number, number] } }[]; project(c: [number, number]): { x: number; y: number } };
    const m = (window as unknown as { __map: M }).__map;
    const f = m.queryRenderedFeatures({ layers: ["clusters"] })[0];
    return f ? m.project(f.geometry.coordinates) : null;
  });
  const { x, y } = (await cluster.jsonValue())!;
  const box = (await page.getByTestId("map").boundingBox())!;
  const zoomBefore = await page.evaluate(() => (window as unknown as { __map: { getZoom(): number } }).__map.getZoom());
  await page.mouse.click(box.x + x, box.y + y);
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __map: { getZoom(): number } }).__map.getZoom()))
    .toBeGreaterThan(zoomBefore);
});

test.describe("near me", () => {
  test.use({ geolocation: { latitude: 40.7655, longitude: -73.9301 }, permissions: ["geolocation"] });

  test("centers on the user and lists nearby businesses by distance", async ({ page }) => {
    await page.goto("/");
    await waitForMap(page);
    await page.getByRole("button", { name: "Near me" }).click();
    await expect(page.getByTestId("ref-marker")).toHaveAttribute("aria-label", "You are here");
    await expect.poll(() => resultSlugs(page).then((s) => s[0])).toBe("e2e-lawyer");
    await expect(page).toHaveURL(/ref=40\.7655(,|%2C)-73\.9301/);
  });
});

test.describe("near me denied", () => {
  test.use({ permissions: [] });

  test("asks the user to type a location instead", async ({ page }) => {
    await page.goto("/");
    await waitForMap(page);
    await page.getByRole("button", { name: "Near me" }).click();
    await expect(page.getByTestId("search-error")).toContainText("Type a city, address or ZIP");
    await expect(page.getByLabel("Search a city, address or ZIP")).toBeFocused();
  });
});

test("location search flies to the place and lists businesses near it", async ({ page }) => {
  await page.route("**/api/geocode?q=*", (route) =>
    route.fulfill({ json: { lat: 40.776, lng: -73.915, label: "Astoria, Queens, NY" } }),
  );
  await page.goto("/");
  await waitForMap(page);
  await page.getByLabel("Search a city, address or ZIP").fill("Astoria, NY");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByTestId("ref-marker")).toHaveAttribute("aria-label", "Searched location");
  await expect.poll(() => resultSlugs(page).then((s) => s[0])).toBe("e2e-cpa");
  await expect(page).toHaveURL(/q=Astoria/);
});

test("unknown location shows an error and leaves the map in place", async ({ page }) => {
  await page.route("**/api/geocode?q=*", (route) => route.fulfill({ status: 404, json: { error: "location not found" } }));
  await page.goto(astoriaUrl());
  await waitForMap(page);
  const center = () => page.evaluate(() => (window as unknown as { __map: { getCenter(): { lat: number } } }).__map.getCenter().lat);
  const before = await center();
  await page.getByLabel("Search a city, address or ZIP").fill("qwertyuiop");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByTestId("search-error")).toContainText("Location not found");
  expect(await center()).toBeCloseTo(before, 6);
});

test("category filter shows only that category and survives reload", async ({ page }) => {
  await page.goto(astoriaUrl());
  await waitForMap(page);
  await expect(page.getByTestId("result-item").first()).toBeVisible();
  await page.getByLabel("Filter by category").selectOption("lawyer");
  await expect.poll(() => resultSlugs(page)).toEqual(["e2e-lawyer"]);
  await expect(page).toHaveURL(/cat=lawyer/);

  await page.reload();
  await waitForMap(page);
  await expect(page.getByRole("button", { name: "Remove Lawyer filter" })).toBeVisible();
  await expect.poll(() => resultSlugs(page)).toEqual(["e2e-lawyer"]);
});

test("group filter shows every category in the group", async ({ page }) => {
  await page.goto(astoriaUrl());
  await waitForMap(page);
  await page.getByRole("button", { name: "Food & Dining" }).click();
  await expect.poll(() => resultSlugs(page).then((s) => s.sort())).toEqual(["e2e-bakery", "e2e-taverna"]);
});

test("selecting a result opens its detail and highlights it", async ({ page }) => {
  await page.goto(astoriaUrl());
  await waitForMap(page);
  await page.locator('[data-slug="e2e-taverna"]').click();
  await expect(page.getByTestId("business-detail")).toContainText("E2E taverna");
  await expect(page.getByRole("link", { name: "Get directions" })).toHaveAttribute("href", /destination=40\.7725,-73\.926/);
  await expect(page).toHaveURL(/b=e2e-taverna/);
});
