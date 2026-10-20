import Link from "next/link";
import type { BusinessInView } from "@/lib/directory";
import { formatDistance } from "@/lib/map-state";

type Props = {
  items: BusinessInView[];
  selected: string | null;
  loading: boolean;
  onSelect(slug: string): void;
};

export function ResultsList({ items, selected, loading, onSelect }: Props) {
  if (!loading && items.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-slate-600" data-testid="results-empty">
        <p className="font-medium text-slate-800">No Greek-owned businesses here yet.</p>
        <p className="mt-1">Try zooming out or clearing filters.</p>
        <p className="mt-4">
          Know one?{" "}
          <Link href="/submit" className="font-medium text-[#0d5eaf] underline">
            Submit a business
          </Link>
        </p>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-slate-100" data-testid="results-list" aria-busy={loading}>
      {items.map((b) => (
        <li key={b.id}>
          <button
            type="button"
            onClick={() => onSelect(b.slug)}
            aria-current={b.slug === selected}
            data-testid="result-item"
            data-slug={b.slug}
            className={`flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 ${
              b.slug === selected ? "bg-blue-50" : ""
            }`}
          >
            <span className="min-w-0">
              <span className="block truncate font-medium text-slate-900">{b.name}</span>
              <span className="block truncate text-sm text-slate-600">{b.primary_category_name ?? "Other"}</span>
            </span>
            <span className="shrink-0 text-sm tabular-nums text-slate-500" data-testid="result-distance">
              {formatDistance(b.distance_m)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
