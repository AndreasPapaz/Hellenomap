"use client";

import Link from "next/link";
import Script from "next/script";
import { startTransition, useActionState, useEffect, useState } from "react";
import type { Taxonomy } from "@/lib/directory";
import type { SubmissionResult } from "@/lib/submission.server";
import {
  fieldErrors,
  formDataToInput,
  MAX_CATEGORIES,
  submissionSchema,
  type FieldErrors,
} from "@/lib/submission-schema";
import { submitBusiness } from "./actions";

declare global {
  interface Window {
    turnstile?: { reset(widget?: string): void };
  }
}

const inputClass =
  "mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-base shadow-sm outline-none focus:border-[#0d5eaf] aria-[invalid=true]:border-red-600";

export function SubmitForm({ taxonomy, turnstileSiteKey }: { taxonomy: Taxonomy; turnstileSiteKey: string }) {
  const [result, formAction, pending] = useActionState<SubmissionResult | null, FormData>(submitBusiness, null);
  const [clientErrors, setClientErrors] = useState<FieldErrors>({});
  const [categories, setCategories] = useState<string[]>([]);

  // Turnstile tokens are single-use: get a fresh one after every server response.
  useEffect(() => {
    if (result && !result.ok) window.turnstile?.reset();
  }, [result]);

  if (result?.ok) {
    return (
      <div className="mt-8 rounded-xl bg-green-50 p-6" role="status" data-testid="submit-success">
        <h2 className="text-lg font-semibold text-green-900">Thanks! Your submission is in review.</h2>
        <p className="mt-2 text-green-900">
          We check every business before it appears on the map. If it qualifies, you&apos;ll see it there soon.
        </p>
        <Link href="/" className="mt-4 inline-block font-medium text-[#0d5eaf] underline">
          Back to the map
        </Link>
      </div>
    );
  }

  const errors: FieldErrors = { ...(result && !result.ok ? result.fieldErrors : {}), ...clientErrors };
  const allCategories = taxonomy.flatMap((g) =>
    g.categories.map((c) => ({ ...c, label: c.name === "Other" ? `Other ${g.name}` : c.name })),
  );

  const field = (name: keyof FieldErrors) => ({
    name,
    id: name,
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
  });
  const error = (name: keyof FieldErrors) =>
    errors[name] ? (
      <p id={`${name}-error`} className="mt-1 text-sm text-red-700">
        {errors[name]}
      </p>
    ) : null;

  return (
    <form
      noValidate
      className="mt-8 space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const parsed = submissionSchema.safeParse(formDataToInput(fd));
        const errs = parsed.success ? {} : fieldErrors(parsed.error);
        setClientErrors(errs);
        if (!parsed.success) {
          document.getElementById(Object.keys(errs)[0])?.focus();
          return;
        }
        // Calling the action ourselves (instead of <form action>) keeps the fields filled in on errors.
        startTransition(() => formAction(fd));
      }}
    >
      <div>
        <label htmlFor="name" className="font-medium text-slate-900">
          Business name <span className="text-red-700">*</span>
        </label>
        <input {...field("name")} className={inputClass} maxLength={200} autoComplete="organization" />
        {error("name")}
      </div>

      <div>
        <label htmlFor="categories" className="font-medium text-slate-900">
          Category <span className="text-red-700">*</span>
        </label>
        <select
          id="categories"
          className={inputClass}
          value=""
          aria-invalid={errors.categories ? true : undefined}
          aria-describedby={errors.categories ? "categories-error" : "categories-hint"}
          disabled={categories.length >= MAX_CATEGORIES}
          onChange={(e) => {
            const slug = e.target.value;
            if (slug && !categories.includes(slug)) setCategories([...categories, slug]);
          }}
        >
          <option value="">{categories.length ? "Add another category…" : "Choose a category…"}</option>
          {taxonomy.map((g) => (
            <optgroup key={g.slug} label={g.name}>
              {g.categories.map((c) => (
                <option key={c.slug} value={c.slug} disabled={categories.includes(c.slug)}>
                  {c.name === "Other" ? `Other ${g.name}` : c.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <p id="categories-hint" className="mt-1 text-sm text-slate-500">
          Up to {MAX_CATEGORIES}. The first one is shown as the main category.
        </p>
        {categories.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-2">
            {categories.map((slug) => (
              <li key={slug}>
                <input type="hidden" name="categories" value={slug} />
                <button
                  type="button"
                  onClick={() => setCategories(categories.filter((c) => c !== slug))}
                  className="rounded-full bg-[#0d5eaf] px-3 py-1 text-sm text-white"
                  aria-label={`Remove ${allCategories.find((c) => c.slug === slug)?.label}`}
                >
                  {allCategories.find((c) => c.slug === slug)?.label} ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        {error("categories")}
      </div>

      <div>
        <label htmlFor="address" className="font-medium text-slate-900">
          Street address <span className="text-red-700">*</span>
        </label>
        <input
          {...field("address")}
          className={inputClass}
          maxLength={300}
          placeholder="123 Main St, Chicago, IL 60601"
          autoComplete="street-address"
        />
        {error("address")}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="phone" className="font-medium text-slate-900">
            Phone
          </label>
          <input {...field("phone")} type="tel" className={inputClass} maxLength={30} autoComplete="tel" />
          {error("phone")}
        </div>
        <div>
          <label htmlFor="website" className="font-medium text-slate-900">
            Website
          </label>
          <input {...field("website")} className={inputClass} maxLength={300} placeholder="example.com" inputMode="url" />
          {error("website")}
        </div>
      </div>

      <div>
        <label htmlFor="description" className="font-medium text-slate-900">
          Description
        </label>
        <textarea {...field("description")} rows={4} className={inputClass} maxLength={2000} />
        {error("description")}
      </div>

      <fieldset className="space-y-5 rounded-xl border border-slate-200 p-4">
        <legend className="px-1 text-sm font-medium text-slate-600">Only seen by the site owner</legend>
        <div>
          <label htmlFor="ownershipNote" className="font-medium text-slate-900">
            What makes it Greek-owned?
          </label>
          <textarea
            {...field("ownershipNote")}
            rows={3}
            className={inputClass}
            maxLength={2000}
            placeholder="e.g. Owned by the Papadopoulos family since 1985"
          />
          {error("ownershipNote")}
        </div>
        <div>
          <label htmlFor="email" className="font-medium text-slate-900">
            Your email <span className="text-red-700">*</span>
          </label>
          <input {...field("email")} type="email" className={inputClass} maxLength={254} autoComplete="email" />
          {error("email")}
        </div>
      </fieldset>

      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
      <div className="cf-turnstile" data-sitekey={turnstileSiteKey} />

      {result && !result.ok && result.formError && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-red-800" data-testid="form-error">
          {result.formError}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="h-11 rounded-full bg-[#0d5eaf] px-6 font-medium text-white disabled:opacity-60"
      >
        {pending ? "Submitting…" : "Submit for review"}
      </button>
    </form>
  );
}
