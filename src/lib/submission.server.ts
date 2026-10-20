import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { GeocodeResult } from "./geocode";
import { fieldErrors, submissionSchema, type FieldErrors, type SubmissionInput } from "./submission-schema";
import type { Database } from "./supabase/database.types";
import { uniqueSlug } from "./unique-slug";

export const RATE_LIMIT_PER_HOUR = 5;

export type SubmissionResult =
  | { ok: true; needsLocation: boolean; possibleDuplicate: boolean }
  | { ok: false; fieldErrors?: FieldErrors; formError?: string };

export type SubmissionDeps = {
  /** Service-role client: the public cannot insert directly (RLS). */
  db: SupabaseClient<Database>;
  verifyCaptcha(token: string | null): Promise<boolean>;
  geocode(address: string): Promise<GeocodeResult | null>;
  /** Stable, non-reversible identifier for the submitting client (see hashClient). */
  clientHash: string;
};

export function hashClient(ip: string | null, salt: string): string {
  return createHash("sha256").update(`${salt}:${ip ?? "unknown"}`).digest("hex");
}

export async function createSubmission(
  input: SubmissionInput,
  captchaToken: string | null,
  deps: SubmissionDeps,
): Promise<SubmissionResult> {
  const { db } = deps;

  const parsed = submissionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };
  const sub = parsed.data;

  if (!(await deps.verifyCaptcha(captchaToken))) {
    return { ok: false, formError: "Please complete the verification challenge and try again." };
  }

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error: countErr } = await db
    .from("submission_private")
    .select("business_id", { count: "exact", head: true })
    .eq("client_hash", deps.clientHash)
    .gte("created_at", since);
  if (countErr) throw countErr;
  if ((count ?? 0) >= RATE_LIMIT_PER_HOUR) {
    return { ok: false, formError: "You've submitted several businesses recently. Please try again later." };
  }

  const { data: cats, error: catErr } = await db.from("categories").select("id, slug").in("slug", sub.categories);
  if (catErr) throw catErr;
  if (cats.length !== sub.categories.length) return { ok: false, fieldErrors: { categories: "Invalid category" } };
  const categoryIds = sub.categories.map((slug) => cats.find((c) => c.slug === slug)!.id);

  let location: GeocodeResult | null = null;
  try {
    location = await deps.geocode(sub.address);
  } catch {
    location = null; // Owner fixes the location during review.
  }

  let duplicateOf: string | null = null;
  if (location) {
    const { data, error } = await db.rpc("find_possible_duplicate", {
      candidate_name: sub.name,
      lng: location.lng,
      lat: location.lat,
    });
    if (error) throw error;
    duplicateOf = data;
  }

  const { data: business, error: insErr } = await db
    .from("businesses")
    .insert({
      slug: await uniqueSlug(db, sub.name),
      name: sub.name,
      description: sub.description,
      address: sub.address,
      phone: sub.phone,
      website: sub.website,
      location: location ? `SRID=4326;POINT(${location.lng} ${location.lat})` : null,
      status: "pending",
      published: false,
      origin: "submission",
      needs_location: !location,
      possible_duplicate_of: duplicateOf,
    })
    .select("id")
    .single();
  if (insErr) throw insErr;

  try {
    const { error: bcErr } = await db
      .from("business_categories")
      .insert(categoryIds.map((id, i) => ({ business_id: business.id, category_id: id, is_primary: i === 0 })));
    if (bcErr) throw bcErr;
    const { error: privErr } = await db.from("submission_private").insert({
      business_id: business.id,
      submitter_email: sub.email,
      ownership_note: sub.ownershipNote,
      client_hash: deps.clientHash,
    });
    if (privErr) throw privErr;
  } catch (err) {
    await db.from("businesses").delete().eq("id", business.id);
    throw err;
  }

  return { ok: true, needsLocation: !location, possibleDuplicate: duplicateOf !== null };
}
