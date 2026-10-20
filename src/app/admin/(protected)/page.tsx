import { BusinessCard } from "@/components/admin/BusinessCard";
import { listByStatus } from "@/lib/admin-data.server";
import { getAdmin } from "@/lib/admin.server";

export default async function PendingQueue() {
  const admin = await getAdmin();
  if (!admin) return null; // the layout shows "Not authorized"
  const items = await listByStatus(admin, "pending");
  return (
    <section>
      <h1 className="mb-4 text-xl font-semibold">Pending submissions ({items.length})</h1>
      {items.length === 0 ? (
        <p className="text-slate-600">Nothing to review. 🎉</p>
      ) : (
        <ol className="space-y-4" data-testid="pending-queue">
          {items.map((b) => (
            <li key={b.id}>
              <BusinessCard b={b} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
