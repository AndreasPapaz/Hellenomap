"use server";

import { headers } from "next/headers";
import { geocode } from "@/lib/geocode";
import { createSubmission, hashClient, type SubmissionResult } from "@/lib/submission.server";
import { formDataToInput } from "@/lib/submission-schema";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyTurnstile } from "@/lib/turnstile";

export async function submitBusiness(_prev: SubmissionResult | null, formData: FormData): Promise<SubmissionResult> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || null;
  const token = (formData.get("cf-turnstile-response") as string | null) || null;
  try {
    return await createSubmission(formDataToInput(formData), token, {
      db: createServiceClient(),
      verifyCaptcha: (t) => verifyTurnstile(t, ip),
      geocode: (address) => geocode(address),
      clientHash: hashClient(ip, process.env.IP_HASH_SALT ?? ""),
    });
  } catch (err) {
    console.error("submitBusiness failed", err);
    return { ok: false, formError: "Something went wrong saving your submission. Please try again." };
  }
}
