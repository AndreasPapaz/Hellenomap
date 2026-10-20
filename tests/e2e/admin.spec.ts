import { expect, test } from "@playwright/test";
import { db, emailsTo, setAdmin, signIn } from "./support";

const OWNER = "owner-e2e@example.com";
const STRANGER = "stranger-e2e@example.com";
const PREFIX = "E2E Admin ";

type Seed = { name: string; minutesAgo: number; point?: [number, number] | null; category?: string; status?: "pending" | "approved"; origin?: "import" | "submission" };

async function seedBusiness(s: Seed) {
  const client = db();
  const approved = s.status === "approved";
  const { data, error } = await client
    .from("businesses")
    .insert({
      slug: s.name.toLowerCase().replace(/\s+/g, "-"),
      name: s.name,
      address: "100 Test Ave, Astoria, NY 11102",
      location: s.point === null ? null : `SRID=4326;POINT(${(s.point ?? [-73.92, 40.77]).join(" ")})`,
      status: s.status ?? "pending",
      published: approved,
      origin: s.origin ?? "submission",
      needs_location: s.point === null,
      source_url: s.origin === "import" ? `https://greekamericandirectory.com/listing/${s.name.replace(/\s+/g, "-")}/` : null,
      created_at: new Date(Date.now() - s.minutesAgo * 60_000).toISOString(),
    })
    .select("id")
    .single();
  if (error) throw error;
  const { data: cat } = await client.from("categories").select("id").eq("slug", s.category ?? "deli").single();
  await client.from("business_categories").insert({ business_id: data.id, category_id: cat!.id, is_primary: true });
  if (!approved) {
    await client.from("submission_private").insert({ business_id: data.id, submitter_email: "sub@example.com", ownership_note: "Cretan family", client_hash: "e2e" });
  }
  return data.id as string;
}

const cleanup = async () => {
  await db().from("businesses").delete().like("name", `${PREFIX}%`);
  await setAdmin(OWNER, false);
  await setAdmin(STRANGER, false);
};

test.beforeEach(async () => {
  await cleanup();
  await setAdmin(OWNER, true);
});
test.afterAll(cleanup);

test("signed-out visitors are sent to the login page", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test("non-allowlisted emails get no sign-in link and cannot moderate", async ({ page }) => {
  const since = Date.now() - 1000;
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(STRANGER);
  await page.getByRole("button", { name: "Email me a link" }).click();
  await expect(page.getByTestId("login-sent")).toBeVisible();
  await page.waitForTimeout(1000);
  expect(await emailsTo(STRANGER, since)).toBe(0);

  // A user who signs in and then loses admin rights is refused by the page and by the action itself.
  const id = await seedBusiness({ name: `${PREFIX}Revoked`, minutesAgo: 1 });
  await setAdmin(STRANGER, true);
  await signIn(page, STRANGER);
  await page.goto(`/admin/review/${id}`);
  await expect(page.getByTestId("editor")).toBeVisible();
  await setAdmin(STRANGER, false);
  await page.getByRole("button", { name: "Approve & publish" }).click();
  await expect(page.getByTestId("moderation-result")).toHaveText("Not authorized");
  const { data } = await db().from("businesses").select("status").eq("id", id).single();
  expect(data!.status).toBe("pending");
  await page.goto("/admin");
  await expect(page.getByTestId("admin-denied")).toBeVisible();
});

test("pending queue lists oldest first with flags and private details", async ({ page }) => {
  const existing = await seedBusiness({ name: `${PREFIX}Agora`, minutesAgo: 500, status: "approved" });
  await seedBusiness({ name: `${PREFIX}Newer`, minutesAgo: 5, point: null });
  const older = await seedBusiness({ name: `${PREFIX}Older`, minutesAgo: 60 });
  await db().from("businesses").update({ possible_duplicate_of: existing }).eq("id", older);

  await signIn(page, OWNER);
  const cards = page.getByTestId("pending-queue").getByTestId("admin-card").filter({ hasText: PREFIX });
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0)).toContainText(`${PREFIX}Older`);
  await expect(cards.nth(0)).toContainText(`Possible duplicate of ${PREFIX}Agora`);
  await expect(cards.nth(0)).toContainText("sub@example.com");
  await expect(cards.nth(0)).toContainText("Cretan family");
  await expect(cards.nth(1)).toContainText(`${PREFIX}Newer`);
  await expect(cards.nth(1)).toContainText("Needs location");
});

test("approving with edits publishes under the edited category", async ({ page }) => {
  const id = await seedBusiness({ name: `${PREFIX}Approve`, minutesAgo: 10, category: "deli" });
  await signIn(page, OWNER);
  await page.goto(`/admin/review/${id}`);
  await page.getByRole("button", { name: "Remove Deli" }).click();
  await page.getByLabel("Categories").selectOption("bakery");
  await page.getByRole("button", { name: "Approve & publish" }).click();
  await expect(page.getByTestId("moderation-result")).toHaveText("Saved.");
  await expect(page.getByTestId("status")).toContainText("approved · published");

  const { data } = await db().rpc("businesses_in_view", {
    min_lng: -74, min_lat: 40.7, max_lng: -73.8, max_lat: 40.8, ref_lng: -73.92, ref_lat: 40.77, category_slugs: ["bakery"],
  });
  expect(data!.map((b) => b.name)).toContain(`${PREFIX}Approve`);
  const res = await page.goto(`/b/${PREFIX.toLowerCase().replace(/\s+/g, "-")}approve`);
  expect(res?.status()).toBe(200);
  await expect(page.getByTestId("business-detail")).toContainText("Bakery");
});

test("a submission without a location cannot be approved until the owner sets one", async ({ page }) => {
  const id = await seedBusiness({ name: `${PREFIX}NoLoc`, minutesAgo: 10, point: null });
  await signIn(page, OWNER);
  await page.goto(`/admin/review/${id}`);
  await page.getByRole("button", { name: "Approve & publish" }).click();
  await expect(page.getByTestId("moderation-result")).toHaveText("Set a location before approving.");

  const map = page.getByTestId("editor").getByTestId("location-map");
  await page.waitForTimeout(1500); // let the map finish loading
  await map.click({ position: { x: 150, y: 120 } });
  await expect(page.getByTestId("location-text")).not.toHaveText("No location set");
  await page.getByRole("button", { name: "Approve & publish" }).click();
  await expect(page.getByTestId("moderation-result")).toHaveText("Saved.");
  const { data } = await db().from("businesses").select("status, needs_location").eq("id", id).single();
  expect(data).toEqual({ status: "approved", needs_location: false });
});

test("rejecting keeps the business private and lists it under Rejected", async ({ page }) => {
  const id = await seedBusiness({ name: `${PREFIX}Reject`, minutesAgo: 10 });
  await signIn(page, OWNER);
  await page.goto(`/admin/review/${id}`);
  await page.getByLabel("Rejection reason").fill("Not Greek-owned");
  await page.getByRole("button", { name: "Reject" }).click();
  await expect(page.getByTestId("status")).toHaveText("rejected");
  await expect(page.getByTestId("history")).toContainText("Reason: Not Greek-owned");

  await page.goto("/admin/rejected");
  await expect(page.getByTestId("rejected-list")).toContainText(`${PREFIX}Reject`);
  await page.goto("/admin");
  await expect(page.getByText(`${PREFIX}Reject`)).toHaveCount(0);
  const res = await page.goto(`/b/${PREFIX.toLowerCase().replace(/\s+/g, "-")}reject`);
  expect(res?.status()).toBe(404);
});

test("editing, unpublishing and republishing are applied immediately and audited", async ({ page }) => {
  const id = await seedBusiness({ name: `${PREFIX}Imported`, minutesAgo: 100, status: "approved", origin: "import" });
  await signIn(page, OWNER);
  await page.goto("/admin/businesses?q=E2E%20Admin%20Imported");
  await page.getByTestId("business-list").getByRole("link", { name: `${PREFIX}Imported` }).click();

  await page.getByLabel("Phone").fill("(718) 555-0199");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByTestId("moderation-result")).toHaveText("Saved.");
  const { data: edited } = await db().from("businesses").select("phone, owner_edited_fields").eq("id", id).single();
  expect(edited).toEqual({ phone: "(718) 555-0199", owner_edited_fields: ["phone"] });

  const inView = async () =>
    (await db().rpc("businesses_in_view", { min_lng: -74, min_lat: 40.7, max_lng: -73.8, max_lat: 40.8, ref_lng: -73.92, ref_lat: 40.77 }))
      .data!.some((b) => b.id === id);
  expect(await inView()).toBe(true);
  await page.getByRole("button", { name: "Unpublish" }).click();
  await expect(page.getByTestId("status")).toContainText("unpublished");
  expect(await inView()).toBe(false);
  await page.getByRole("button", { name: "Republish" }).click();
  await expect(page.getByTestId("status")).toContainText("approved · published");
  expect(await inView()).toBe(true);

  const history = page.getByTestId("history").locator("li");
  await expect(history).toHaveCount(3);
  await expect(history.nth(0)).toContainText(new RegExp(`republish by ${OWNER}`, "i"));
  await expect(history.nth(1)).toContainText(new RegExp(`unpublish by ${OWNER}`, "i"));
  await expect(history.nth(2)).toContainText(new RegExp(`edit by ${OWNER}`, "i"));
  await expect(history.nth(2)).toContainText("Changed: phone");
});
