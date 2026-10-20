import type { BusinessDetailData } from "@/lib/directory";

const directionsUrl = (b: BusinessDetailData) =>
  `https://www.google.com/maps/dir/?api=1&destination=${b.lat},${b.lng}`;

const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

const displayUrl = (url: string) => url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

export function BusinessDetail({ business: b }: { business: BusinessDetailData }) {
  return (
    <article className="space-y-4" data-testid="business-detail">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">{b.name}</h1>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {b.categories.map((c) => (
            <li key={c.slug} className="rounded-full bg-blue-50 px-2.5 py-0.5 text-sm text-[#0d5eaf]">
              {c.name}
            </li>
          ))}
        </ul>
      </header>

      <dl className="space-y-2 text-slate-800">
        <div>
          <dt className="sr-only">Address</dt>
          <dd>{b.address}</dd>
        </div>
        {b.phone && (
          <div>
            <dt className="sr-only">Phone</dt>
            <dd>
              <a href={telHref(b.phone)} className="text-[#0d5eaf] underline">
                {b.phone}
              </a>
            </dd>
          </div>
        )}
        {b.website && (
          <div>
            <dt className="sr-only">Website</dt>
            <dd>
              <a href={b.website} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-[#0d5eaf] underline">
                {displayUrl(b.website)}
              </a>
            </dd>
          </div>
        )}
      </dl>

      <a
        href={directionsUrl(b)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-10 items-center rounded-full bg-[#0d5eaf] px-4 font-medium text-white"
      >
        Get directions
      </a>

      {b.description && (
        <div className="space-y-2 whitespace-pre-line text-slate-700">{b.description}</div>
      )}

      {b.origin === "import" && b.sourceUrl && (
        <p className="border-t border-slate-100 pt-3 text-xs text-slate-500" data-testid="source-attribution">
          Listing sourced from the{" "}
          <a href={b.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">
            Greek American Directory
          </a>
          .
        </p>
      )}
    </article>
  );
}
