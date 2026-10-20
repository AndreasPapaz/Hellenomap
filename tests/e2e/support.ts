import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../src/lib/supabase/database.types";

export const db = () =>
  createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

// Test businesses around Astoria, NY — far from the Chicago seed data.
export const ASTORIA = { lat: 40.772, lng: -73.925 };

type Seed = {
  slug: string;
  lat: number;
  lng: number;
  categories: string[];
  status?: "approved" | "pending";
  origin?: "import" | "submission";
};

export const SEEDS: Seed[] = [
  { slug: "e2e-taverna", lat: 40.7725, lng: -73.926, categories: ["restaurant", "dinner"], origin: "import" },
  { slug: "e2e-bakery", lat: 40.7695, lng: -73.919, categories: ["bakery"] },
  { slug: "e2e-lawyer", lat: 40.765, lng: -73.93, categories: ["lawyer"] },
  { slug: "e2e-cpa", lat: 40.776, lng: -73.915, categories: ["cpa"] },
  { slug: "e2e-pending", lat: 40.7722, lng: -73.9252, categories: ["deli"], status: "pending" },
];

export async function seed() {
  const client = db();
  await cleanup();
  const { data: cats } = await client.from("categories").select("id, slug");
  const ids = new Map(cats!.map((c) => [c.slug, c.id]));
  for (const s of SEEDS) {
    const approved = (s.status ?? "approved") === "approved";
    const { data, error } = await client
      .from("businesses")
      .insert({
        slug: s.slug,
        name: s.slug.replace("e2e-", "E2E ").replace(/-/g, " "),
        address: "1 Test St, Astoria, NY 11102",
        phone: "(718) 555-0100",
        website: "https://example.com/",
        description: "Seeded for end-to-end tests.",
        location: `SRID=4326;POINT(${s.lng} ${s.lat})`,
        status: s.status ?? "approved",
        published: approved,
        origin: s.origin ?? "submission",
        source_url: s.origin === "import" ? `https://greekamericandirectory.com/listing/${s.slug}/` : null,
      })
      .select("id")
      .single();
    if (error) throw error;
    await client
      .from("business_categories")
      .insert(s.categories.map((c, i) => ({ business_id: data.id, category_id: ids.get(c)!, is_primary: i === 0 })));
  }
}

export async function cleanup() {
  await db().from("businesses").delete().like("slug", "e2e-%");
}

const MAILPIT = "http://127.0.0.1:54324/api/v1";

async function latestLinkFor(email: string, since: number): Promise<string | null> {
  const res = await fetch(`${MAILPIT}/search?query=${encodeURIComponent(`to:${email}`)}&limit=1`);
  const { messages } = (await res.json()) as { messages: { ID: string; Created: string }[] };
  const m = messages[0];
  if (!m || Date.parse(m.Created) < since) return null;
  const msg = (await (await fetch(`${MAILPIT}/message/${m.ID}`)).json()) as { Text: string; HTML: string };
  const link = (msg.HTML || msg.Text).match(/href="([^"]+auth\/v1\/verify[^"]+)"/)?.[1] ?? msg.Text.match(/(http\S+auth\/v1\/verify\S+)/)?.[1];
  return link ? link.replace(/&amp;/g, "&") : null;
}

/** Signs in through the real emailed-link flow, reading the email from the local Mailpit inbox. */
export async function signIn(page: import("@playwright/test").Page, email: string) {
  const since = Date.now() - 1000;
  // Supabase allows one sign-in email per address per second; retry briefly if we hit that.
  for (let attempt = 0; ; attempt++) {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Email me a link" }).click();
    const sent = page.getByTestId("login-sent");
    const failed = page.getByText("Couldn't send the sign-in link");
    await sent.or(failed).waitFor();
    if (await sent.isVisible()) break;
    if (attempt >= 3) throw new Error("sign-in link could not be sent");
    await page.waitForTimeout(1200);
  }
  let link: string | null = null;
  for (let i = 0; i < 30 && !link; i++) {
    link = await latestLinkFor(email, since);
    if (!link) await new Promise((r) => setTimeout(r, 300));
  }
  if (!link) throw new Error(`no sign-in email for ${email}`);
  await page.goto(link);
  await page.waitForURL(/\/admin(\/|$|\?)/);
}

export async function setAdmin(email: string, isAdmin: boolean) {
  if (isAdmin) await db().from("admins").upsert({ email });
  else await db().from("admins").delete().eq("email", email);
}

export async function emailsTo(email: string, since: number): Promise<number> {
  const res = await fetch(`${MAILPIT}/search?query=${encodeURIComponent(`to:${email}`)}`);
  const { messages } = (await res.json()) as { messages: { Created: string }[] };
  return messages.filter((m) => Date.parse(m.Created) >= since).length;
}
