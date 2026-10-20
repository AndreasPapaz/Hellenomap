"use server";

import { revalidatePath } from "next/cache";
import { adminEditSchema, reasonSchema, type AdminEditInput } from "@/lib/admin-schema";
import { NotAuthorizedError, requireAdmin } from "@/lib/admin.server";
import { fieldErrors, type FieldErrors } from "@/lib/submission-schema";

export type ModerationResult = { ok: true } | { ok: false; error: string; fieldErrors?: FieldErrors };

type Action = "approve" | "edit" | "reject" | "unpublish" | "republish";

/**
 * Applies a moderation action. `edits` (for approve/edit) replaces the business's fields,
 * categories and location. Authorization is checked here and again in the database.
 */
export async function moderate(
  id: string,
  action: Action,
  edits?: AdminEditInput,
  reason?: string,
): Promise<ModerationResult> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (err) {
    if (err instanceof NotAuthorizedError) return { ok: false, error: "Not authorized" };
    throw err;
  }

  let args: { p_fields?: Record<string, string | null>; p_categories?: string[]; p_lng?: number; p_lat?: number } = {};
  if (edits && (action === "approve" || action === "edit")) {
    const parsed = adminEditSchema.safeParse(edits);
    if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
    const e = parsed.data;
    args = {
      p_fields: { name: e.name, description: e.description, address: e.address, phone: e.phone, website: e.website },
      p_categories: e.categories,
      ...(e.lat !== null && e.lng !== null ? { p_lat: e.lat, p_lng: e.lng } : {}),
    };
  }
  const parsedReason = reasonSchema.safeParse(reason);
  if (!parsedReason.success) return { ok: false, error: "Reason must be 500 characters or fewer." };

  const { error } = await admin.db.rpc("moderate_business", {
    p_id: id,
    p_action: action,
    p_reason: parsedReason.data,
    ...args,
  });
  if (error) {
    // Errors raised by moderate_business carry a human-readable message (22023 = invalid input).
    if (error.code === "22023") return { ok: false, error: capitalize(error.message) };
    if (error.code === "42501") return { ok: false, error: "Not authorized" };
    console.error("moderate_business failed", error);
    return { ok: false, error: "Something went wrong. Please try again." };
  }

  revalidatePath("/admin", "layout");
  revalidatePath("/", "layout");
  return { ok: true };
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1) + ".";
