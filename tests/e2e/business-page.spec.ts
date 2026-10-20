import { expect, test } from "@playwright/test";
import { cleanup, seed } from "./support";

test.beforeAll(seed);
test.afterAll(cleanup);

test("renders an imported business with attribution", async ({ page }) => {
  const res = await page.goto("/b/e2e-taverna");
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("E2E taverna");
  await expect(page.getByRole("link", { name: "(718) 555-0100" })).toHaveAttribute("href", "tel:7185550100");
  await expect(page.getByTestId("source-attribution").getByRole("link")).toHaveAttribute(
    "href",
    "https://greekamericandirectory.com/listing/e2e-taverna/",
  );
  await expect(page.getByRole("link", { name: "← View on map" })).toHaveAttribute("href", /b=e2e-taverna/);
});

test("pending businesses are not found", async ({ page }) => {
  const res = await page.goto("/b/e2e-pending");
  expect(res?.status()).toBe(404);
});
