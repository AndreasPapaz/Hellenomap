import "server-only";
import { createClient } from "./supabase/server";

export type AdminSession = { db: Awaited<ReturnType<typeof createClient>>; email: string };

/** The signed-in admin, or null if signed out or not on the allowlist (checked in the database). */
export async function getAdmin(): Promise<AdminSession | null> {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user?.email) return null;
  const { data: isAdmin } = await db.rpc("is_admin");
  return isAdmin ? { db, email: user.email } : null;
}

export class NotAuthorizedError extends Error {
  constructor() {
    super("Not authorized");
  }
}

export async function requireAdmin(): Promise<AdminSession> {
  const admin = await getAdmin();
  if (!admin) throw new NotAuthorizedError();
  return admin;
}
