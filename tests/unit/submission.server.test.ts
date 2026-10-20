import { createClient } from "@supabase/supabase-js";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createSubmission, hashClient, RATE_LIMIT_PER_HOUR, type SubmissionDeps } from "@/lib/submission.server";
import type { SubmissionInput } from "@/lib/submission-schema";
import type { Database } from "@/lib/supabase/database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const service = () => createClient<Database>(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = () => createClient<Database>(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

const NAME_PREFIX = "Sub Test ";
const input = (over: Partial<SubmissionInput> = {}): SubmissionInput => ({
  name: `${NAME_PREFIX}Taverna`,
  categories: ["restaurant", "dinner"],
  address: "31-01 Ditmars Blvd, Astoria, NY 11105",
  email: "submitter@example.com",
  phone: "",
  website: "example.com",
  description: "",
  ownershipNote: "Owned by the Papadopoulos family",
  ...over,
});

describe("hashClient", () => {
  it("is stable, salted and does not contain the IP", () => {
    const h = hashClient("203.0.113.9", "salt");
    expect(h).toBe(hashClient("203.0.113.9", "salt"));
    expect(h).not.toBe(hashClient("203.0.113.9", "other"));
    expect(h).not.toContain("203.0.113.9");
  });
});

describe.skipIf(!process.env.HAS_LOCAL_SUPABASE)("createSubmission (local Supabase)", () => {
  const db = service();
  let n = 0;
  const deps = (over: Partial<SubmissionDeps> = {}): SubmissionDeps => ({
    db,
    verifyCaptcha: async (t) => t === "good",
    geocode: async () => ({ lat: 40.7753, lng: -73.9123, label: "Astoria" }),
    clientHash: `test-client-${Date.now()}-${n++}`,
    ...over,
  });
  const cleanup = () => db.from("businesses").delete().like("name", `${NAME_PREFIX}%`);
  const find = (name: string) =>
    db
      .from("businesses")
      .select("*, submission_private(*), business_categories(is_primary, categories(slug))")
      .eq("name", name)
      .single();

  beforeAll(cleanup);
  afterEach(cleanup);
  afterAll(cleanup);

  it("stores a valid submission as pending with private details", async () => {
    const r = await createSubmission(input(), "good", deps());
    expect(r).toEqual({ ok: true, needsLocation: false, possibleDuplicate: false });
    const { data } = await find(`${NAME_PREFIX}Taverna`);
    expect(data).toMatchObject({
      status: "pending",
      published: false,
      origin: "submission",
      needs_location: false,
      website: "https://example.com/",
      submission_private: { submitter_email: "submitter@example.com", ownership_note: "Owned by the Papadopoulos family" },
    });
    expect(data!.business_categories.find((c) => c.is_primary)?.categories?.slug).toBe("restaurant");
  });

  it("is invisible to the public", async () => {
    await createSubmission(input(), "good", deps());
    const { data } = await anon().from("businesses").select("id").eq("name", `${NAME_PREFIX}Taverna`);
    expect(data).toEqual([]);
    const { data: priv } = await anon().from("submission_private").select("*");
    expect(priv).toEqual([]);
  });

  it("rejects a failed CAPTCHA and stores nothing", async () => {
    const r = await createSubmission(input(), "bad", deps());
    expect(r).toEqual({ ok: false, formError: expect.stringContaining("verification") });
    expect((await find(`${NAME_PREFIX}Taverna`)).data).toBeNull();
  });

  it("returns field errors without calling the CAPTCHA check", async () => {
    let called = false;
    const r = await createSubmission(input({ address: "" }), "good", deps({ verifyCaptcha: async () => (called = true) }));
    expect(r).toEqual({ ok: false, fieldErrors: { address: "Address is required" } });
    expect(called).toBe(false);
  });

  it(`rejects the ${RATE_LIMIT_PER_HOUR + 1}th submission from one client within an hour`, async () => {
    const d = deps();
    for (let i = 0; i < RATE_LIMIT_PER_HOUR; i++) {
      expect((await createSubmission(input({ name: `${NAME_PREFIX}Rate ${i}` }), "good", d)).ok).toBe(true);
    }
    const r = await createSubmission(input({ name: `${NAME_PREFIX}Rate X` }), "good", d);
    expect(r).toEqual({ ok: false, formError: expect.stringContaining("try again later") });
    expect((await createSubmission(input({ name: `${NAME_PREFIX}Other client` }), "good", deps())).ok).toBe(true);
  });

  it("flags an address that cannot be geocoded", async () => {
    const r = await createSubmission(input(), "good", deps({ geocode: async () => null }));
    expect(r).toEqual({ ok: true, needsLocation: true, possibleDuplicate: false });
    const { data } = await find(`${NAME_PREFIX}Taverna`);
    expect(data).toMatchObject({ needs_location: true, location: null, status: "pending" });
  });

  it("treats geocoder errors as needing a location", async () => {
    const r = await createSubmission(input(), "good", deps({ geocode: async () => Promise.reject(new Error("down")) }));
    expect(r).toMatchObject({ ok: true, needsLocation: true });
  });

  it("flags a near-duplicate and links to the existing business", async () => {
    await createSubmission(input(), "good", deps());
    const { data: first } = await find(`${NAME_PREFIX}Taverna`);
    const r = await createSubmission(
      input(),
      "good",
      deps({ geocode: async () => ({ lat: 40.77545, lng: -73.91235, label: "Astoria" }) }), // ~20 m away
    );
    expect(r).toMatchObject({ ok: true, possibleDuplicate: true });
    const { data: second } = await db
      .from("businesses")
      .select("possible_duplicate_of, slug")
      .eq("name", `${NAME_PREFIX}Taverna`)
      .neq("id", first!.id)
      .single();
    expect(second).toMatchObject({ possible_duplicate_of: first!.id, slug: "sub-test-taverna-2" });
  });

  it("rejects unknown categories", async () => {
    const r = await createSubmission(input({ categories: ["not-a-category"] }), "good", deps());
    expect(r).toEqual({ ok: false, fieldErrors: { categories: "Invalid category" } });
  });
});
