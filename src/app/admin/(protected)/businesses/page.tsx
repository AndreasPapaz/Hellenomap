import Link from "next/link";
import { StatusBadges } from "@/components/admin/BusinessCard";
import { searchBusinesses } from "@/lib/admin-data.server";
import { getAdmin } from "@/lib/admin.server";

export default async function AllBusinesses({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const admin = await getAdmin();
  if (!admin) return null; // the layout shows "Not authorized"
  const items = await searchBusinesses(admin, q);
  return (
    <section>
      <h1 className="mb-4 text-xl font-semibold">All businesses</h1>
      <form className="mb-4 flex gap-2" role="search">
        <label htmlFor="q" className="sr-only">
          Search by name or address
        </label>
        <input
          id="q"
          name="q"
          defaultValue={q}
          placeholder="Search by name or address"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2"
        />
        <button className="rounded-lg bg-[#0d5eaf] px-4 text-white">Search</button>
      </form>
      <p className="mb-2 text-sm text-slate-600">{items.length} result(s){items.length === 200 ? " (showing first 200)" : ""}</p>
      <ul className="divide-y divide-slate-200 rounded-xl bg-white shadow-sm" data-testid="business-list">
        {items.map((b) => (
          <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div className="min-w-0">
              <Link href={`/admin/review/${b.id}`} className="font-medium text-[#0d5eaf] underline">
                {b.name}
              </Link>
              <p className="truncate text-sm text-slate-600">{b.address}</p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className={`rounded-full px-2 py-0.5 ${b.status === "rejected" ? "bg-red-100 text-red-900" : "bg-green-100 text-green-900"}`}>
                {b.status}
              </span>
              <StatusBadges b={b} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
