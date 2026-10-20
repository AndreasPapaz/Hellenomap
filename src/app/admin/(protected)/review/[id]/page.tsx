import Link from "next/link";
import { notFound } from "next/navigation";
import { BusinessEditor } from "@/components/admin/BusinessEditor";
import { StatusBadges } from "@/components/admin/BusinessCard";
import { getAdminBusiness, getHistory } from "@/lib/admin-data.server";
import { getAdmin } from "@/lib/admin.server";
import { getTaxonomy } from "@/lib/taxonomy.server";

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const admin = await getAdmin();
  if (!admin) return null; // the layout shows "Not authorized"
  const [b, history, taxonomy] = await Promise.all([getAdminBusiness(admin, id), getHistory(admin, id), getTaxonomy()]);
  if (!b) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{b.name}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
          <span data-testid="status">
            {b.status}
            {b.status === "approved" ? (b.published ? " · published" : " · unpublished") : ""}
          </span>
          <StatusBadges b={b} />
          {b.status === "approved" && b.published && (
            <Link href={`/b/${b.slug}`} className="underline">
              View public page
            </Link>
          )}
          {b.sourceUrl && (
            <a href={b.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">
              Source listing
            </a>
          )}
        </p>
      </div>

      {b.submitter && (
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="font-semibold">Submitter (private)</h2>
          <p className="mt-1">{b.submitter.email}</p>
          {b.submitter.ownershipNote && <p className="mt-1 text-slate-700">“{b.submitter.ownershipNote}”</p>}
        </section>
      )}

      <BusinessEditor business={b} taxonomy={taxonomy} />

      <section className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="font-semibold">History</h2>
        {history.length === 0 ? (
          <p className="mt-1 text-sm text-slate-600">No moderation actions yet.</p>
        ) : (
          <ol className="mt-2 space-y-2 text-sm" data-testid="history">
            {history.map((h) => (
              <li key={h.id} className="border-l-2 border-slate-200 pl-3">
                <span className="font-medium capitalize">{h.action}</span> by {h.actor} ·{" "}
                <time dateTime={h.at}>{new Date(h.at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</time>
                {h.reason && <p className="text-slate-700">Reason: {h.reason}</p>}
                {h.diff ? (
                  <p className="text-slate-500">Changed: {Object.keys(h.diff as object).join(", ")}</p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
