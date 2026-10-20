import Link from "next/link";
import type { AdminBusiness } from "@/lib/admin-data.server";
import { LocationMap } from "./LocationMap";

export function StatusBadges({ b }: { b: AdminBusiness }) {
  return (
    <span className="flex flex-wrap gap-1.5 text-xs">
      {b.needsLocation && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-900">Needs location</span>}
      {b.possibleDuplicate && (
        <span className="rounded-full bg-orange-100 px-2 py-0.5 text-orange-900">
          Possible duplicate of{" "}
          <Link className="underline" href={`/admin/review/${b.possibleDuplicate.id}`}>
            {b.possibleDuplicate.name}
          </Link>
        </span>
      )}
      {b.status === "approved" && !b.published && (
        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-slate-800">Unpublished</span>
      )}
      {b.origin === "import" && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-900">Imported</span>}
    </span>
  );
}

export function BusinessCard({ b, withMap = true }: { b: AdminBusiness; withMap?: boolean }) {
  return (
    <article className="grid gap-4 rounded-xl bg-white p-4 shadow-sm md:grid-cols-[1fr_260px]" data-testid="admin-card" data-id={b.id}>
      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">{b.name}</h2>
          <time className="text-xs text-slate-500" dateTime={b.createdAt}>
            {new Date(b.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
          </time>
        </div>
        <StatusBadges b={b} />
        <p className="text-sm text-slate-600">{b.categories.map((c) => c.name).join(" · ") || "No category"}</p>
        <p>{b.address}</p>
        {b.phone && <p className="text-sm">{b.phone}</p>}
        {b.website && (
          <p className="truncate text-sm">
            <a href={b.website} target="_blank" rel="noopener noreferrer nofollow" className="text-[#0d5eaf] underline">
              {b.website}
            </a>
          </p>
        )}
        {b.description && <p className="line-clamp-3 text-sm text-slate-700">{b.description}</p>}
        {b.submitter && (
          <div className="mt-2 rounded-lg bg-slate-50 p-2 text-sm">
            <p>
              <span className="text-slate-500">Submitted by</span> {b.submitter.email}
            </p>
            {b.submitter.ownershipNote && (
              <p>
                <span className="text-slate-500">Greek connection:</span> {b.submitter.ownershipNote}
              </p>
            )}
          </div>
        )}
        <p className="pt-2">
          <Link href={`/admin/review/${b.id}`} className="font-medium text-[#0d5eaf] underline">
            Review
          </Link>
        </p>
      </div>
      {withMap && <LocationMap point={b.point} className="h-40 md:h-full md:min-h-40" />}
    </article>
  );
}
