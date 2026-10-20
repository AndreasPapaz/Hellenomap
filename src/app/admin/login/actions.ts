"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export type LoginState = { sent: boolean; error?: string };

export async function requestSignInLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = z.string().trim().toLowerCase().email().safeParse(formData.get("email"));
  if (!parsed.success) return { sent: false, error: "Enter a valid email address" };
  const email = parsed.data;

  // Only allowlisted owners get a link; everyone sees the same response so the allowlist isn't revealed.
  const { data: admin } = await createServiceClient().from("admins").select("email").eq("email", email).maybeSingle();
  if (admin) {
    const h = await headers();
    const origin = h.get("origin") ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
    const { error } = await (await createClient()).auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${origin}/auth/callback?next=/admin`, shouldCreateUser: true },
    });
    if (error) {
      console.error("signInWithOtp failed", error);
      return { sent: false, error: "Couldn't send the sign-in link. Please try again in a minute." };
    }
  }
  return { sent: true };
}

export async function signOut() {
  await (await createClient()).auth.signOut();
  redirect("/admin/login");
}
