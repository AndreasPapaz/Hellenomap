import { expect, test } from "@playwright/test";
import { db } from "./support";

const NAME = "E2E Submitted Bakery";
const cleanup = () => db().from("businesses").delete().eq("name", NAME);
// Synthetic clicks on a scrolled page get routed into Turnstile's cross-origin iframe in
// headless Chromium, so use a viewport tall enough to show the whole form.
test.use({ viewport: { width: 1280, height: 1400 } });

test.beforeAll(cleanup);
test.afterAll(cleanup);

test("missing address shows a field error and does not submit", async ({ page }) => {
  await page.goto("/submit");
  await page.getByLabel("Business name").fill(NAME);
  await page.getByLabel("Category").selectOption("bakery");
  await page.getByLabel("Your email").fill("e2e@example.com");
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.locator("#address-error")).toHaveText("Address is required");
  await expect(page.getByLabel("Street address")).toBeFocused();
  await expect(page.getByTestId("submit-success")).toHaveCount(0);
});

test("a valid submission is accepted and stays off the public map", async ({ page }) => {
  await page.goto("/submit");
  await page.getByLabel("Business name").fill(NAME);
  await page.getByLabel("Category").selectOption("bakery");
  await page.getByLabel("Street address").fill("31-01 Ditmars Blvd, Astoria, NY 11105");
  await page.getByLabel("Website").fill("example.com");
  await page.getByLabel("What makes it Greek-owned?").fill("Family from Crete");
  await page.getByLabel("Your email").fill("e2e@example.com");
  // Cloudflare's test site key passes automatically once the widget has produced a token.
  await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/, { timeout: 15_000 });
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.getByTestId("submit-success")).toBeVisible({ timeout: 15_000 });

  const { data } = await db().from("businesses").select("status, published, submission_private(submitter_email)").eq("name", NAME).single();
  expect(data).toMatchObject({ status: "pending", published: false, submission_private: { submitter_email: "e2e@example.com" } });
});
