"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { moderate, type ModerationResult } from "@/app/admin/actions";
import type { AdminBusiness } from "@/lib/admin-data.server";
import type { Taxonomy } from "@/lib/directory";
import { MAX_CATEGORIES, type FieldErrors } from "@/lib/submission-schema";
import { LocationMap } from "./LocationMap";

const inputClass =
  "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 shadow-sm outline-none focus:border-[#0d5eaf] aria-[invalid=true]:border-red-600";

export function BusinessEditor({ business: b, taxonomy }: { business: AdminBusiness; taxonomy: Taxonomy }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fields, setFields] = useState({
    name: b.name,
    address: b.address,
    phone: b.phone ?? "",
    website: b.website ?? "",
    description: b.description ?? "",
  });
  const [categories, setCategories] = useState(b.categories.map((c) => c.slug));
  const [point, setPoint] = useState(b.point);
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<ModerationResult | null>(null);

  const errors: FieldErrors = result && !result.ok ? (result.fieldErrors ?? {}) : {};
  const label = (slug: string) => {
    for (const g of taxonomy) {
      const c = g.categories.find((c) => c.slug === slug);
      if (c) return c.name === "Other" ? `Other ${g.name}` : c.name;
    }
    return slug;
  };

  const run = (action: "approve" | "edit" | "reject" | "unpublish" | "republish") =>
    startTransition(async () => {
      const withEdits = action === "approve" || action === "edit";
      const r = await moderate(
        b.id,
        action,
        withEdits ? { ...fields, categories, lat: point?.lat ?? null, lng: point?.lng ?? null } : undefined,
        action === "reject" ? reason : undefined,
      );
      setResult(r);
      if (r.ok) router.refresh();
    });

  const text = (name: keyof typeof fields, labelText: string, multiline = false) => (
    <div>
      <label htmlFor={`edit-${name}`} className="font-medium">
        {labelText}
      </label>
      {multiline ? (
        <textarea
          id={`edit-${name}`}
          rows={4}
          value={fields[name]}
          onChange={(e) => setFields({ ...fields, [name]: e.target.value })}
          aria-invalid={errors[name] ? true : undefined}
          className={inputClass}
        />
      ) : (
        <input
          id={`edit-${name}`}
          value={fields[name]}
          onChange={(e) => setFields({ ...fields, [name]: e.target.value })}
          aria-invalid={errors[name] ? true : undefined}
          className={inputClass}
        />
      )}
      {errors[name] && <p className="mt-1 text-sm text-red-700">{errors[name]}</p>}
    </div>
  );

  return (
    <section className="space-y-4 rounded-xl bg-white p-4 shadow-sm" data-testid="editor">
      <h2 className="font-semibold">Details</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-4">
          {text("name", "Name")}
          {text("address", "Address")}
          {text("phone", "Phone")}
          {text("website", "Website")}
        </div>
        <div>
          <p className="font-medium">Location</p>
          <p className="mb-1 text-sm text-slate-600">Click the map or drag the pin to set the location.</p>
          <LocationMap point={point} onChange={setPoint} className="h-64" />
          <p className="mt-1 text-xs text-slate-500" data-testid="location-text">
            {point ? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}` : "No location set"}
          </p>
        </div>
      </div>
      {text("description", "Description", true)}

      <div>
        <label htmlFor="edit-categories" className="font-medium">
          Categories
        </label>
        <select
          id="edit-categories"
          className={inputClass}
          value=""
          disabled={categories.length >= MAX_CATEGORIES}
          onChange={(e) => e.target.value && !categories.includes(e.target.value) && setCategories([...categories, e.target.value])}
        >
          <option value="">Add a category…</option>
          {taxonomy.map((g) => (
            <optgroup key={g.slug} label={g.name}>
              {g.categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name === "Other" ? `Other ${g.name}` : c.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <ul className="mt-2 flex flex-wrap gap-2">
          {categories.map((slug, i) => (
            <li key={slug}>
              <button
                type="button"
                onClick={() => setCategories(categories.filter((c) => c !== slug))}
                className="rounded-full bg-[#0d5eaf] px-3 py-1 text-sm text-white"
                aria-label={`Remove ${label(slug)}`}
              >
                {label(slug)}
                {i === 0 ? " (main)" : ""} ✕
              </button>
            </li>
          ))}
        </ul>
        {errors.categories && <p className="mt-1 text-sm text-red-700">{errors.categories}</p>}
      </div>

      {result && (
        <p
          role={result.ok ? "status" : "alert"}
          data-testid="moderation-result"
          className={`rounded-lg px-3 py-2 ${result.ok ? "bg-green-50 text-green-900" : "bg-red-50 text-red-800"}`}
        >
          {result.ok ? "Saved." : result.error}
        </p>
      )}

      <div className="flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4">
        {b.status === "pending" && (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() => run("approve")}
              className="h-10 rounded-full bg-green-700 px-5 font-medium text-white disabled:opacity-60"
            >
              Approve &amp; publish
            </button>
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label htmlFor="reject-reason" className="block text-sm text-slate-600">
                  Rejection reason (private, optional)
                </label>
                <input
                  id="reject-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={500}
                  className="mt-1 rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => run("reject")}
                className="h-10 rounded-full border border-red-700 px-5 font-medium text-red-700 disabled:opacity-60"
              >
                Reject
              </button>
            </div>
          </>
        )}
        {b.status === "approved" && (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() => run("edit")}
              className="h-10 rounded-full bg-[#0d5eaf] px-5 font-medium text-white disabled:opacity-60"
            >
              Save changes
            </button>
            {b.published ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => run("unpublish")}
                className="h-10 rounded-full border border-slate-400 px-5 font-medium disabled:opacity-60"
              >
                Unpublish
              </button>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={() => run("republish")}
                className="h-10 rounded-full border border-slate-400 px-5 font-medium disabled:opacity-60"
              >
                Republish
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}
