import { z } from "zod";

export const MAX_CATEGORIES = 5;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer`)
    .transform((v) => v || null)
    .nullable()
    .optional()
    .transform((v) => v ?? null);

/** Accepts "example.com" or "https://example.com"; stores a full http(s) URL. */
const website = z
  .string()
  .trim()
  .max(300, "Must be 300 characters or fewer")
  .transform((v, ctx) => {
    if (!v) return null;
    const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
    try {
      const url = new URL(withScheme);
      if (!/^https?:$/.test(url.protocol) || !url.hostname.includes(".") || /\s/.test(v)) throw new Error();
      return url.toString();
    } catch {
      ctx.addIssue({ code: "custom", message: "Enter a valid website address, like example.com" });
      return z.NEVER;
    }
  })
  .nullable()
  .optional()
  .transform((v) => v ?? null);

const phone = z
  .string()
  .trim()
  .max(30, "Must be 30 characters or fewer")
  .refine((v) => !v || (/^[+\d\s().\-x]+$/i.test(v) && v.replace(/\D/g, "").length >= 7), {
    message: "Enter a valid phone number",
  })
  .transform((v) => v || null)
  .nullable()
  .optional()
  .transform((v) => v ?? null);

export const submissionSchema = z.object({
  name: z.string().trim().min(1, "Business name is required").max(200, "Must be 200 characters or fewer"),
  categories: z
    .array(z.string().regex(/^[a-z0-9-]+$/, "Invalid category"))
    .min(1, "Choose at least one category")
    .max(MAX_CATEGORIES, `Choose at most ${MAX_CATEGORIES} categories`)
    .transform((c) => [...new Set(c)]),
  address: z
    .string()
    .trim()
    .min(1, "Address is required")
    .min(5, "Enter the full street address")
    .max(300, "Must be 300 characters or fewer"),
  email: z.string().trim().min(1, "Your email is required").max(254).email("Enter a valid email address"),
  phone,
  website,
  description: optionalText(2000),
  ownershipNote: optionalText(2000),
});

export type SubmissionInput = z.input<typeof submissionSchema>;
export type Submission = z.output<typeof submissionSchema>;
export type FieldErrors = Partial<Record<keyof SubmissionInput, string>>;

export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as keyof SubmissionInput;
    out[key] ??= issue.message;
  }
  return out;
}

export function formDataToInput(fd: FormData): SubmissionInput {
  const s = (k: string) => (fd.get(k) as string | null) ?? "";
  return {
    name: s("name"),
    categories: fd.getAll("categories").map(String),
    address: s("address"),
    email: s("email"),
    phone: s("phone"),
    website: s("website"),
    description: s("description"),
    ownershipNote: s("ownershipNote"),
  };
}
