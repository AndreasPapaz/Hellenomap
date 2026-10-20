import { BusinessCard } from "@/components/admin/BusinessCard";
import { listByStatus } from "@/lib/admin-data.server";
import { getAdmin } from "@/lib/admin.server";

export default async function RejectedList() {
  const admin = await getAdmin();
  if (!admin) return null; // the layout shows "Not authorized"
  const items = await listByStatus(admin, "rejected");
  return (
    <section>
      <h1 className="mb-4 text-xl font-semibold">Rejected ({items.length})</h1>
      <ol className="space-y-4" data-testid="rejected-list">
        {items.map((b) => (
          <li key={b.id}>
            <BusinessCard b={b} withMap={false} />
          </li>
        ))}
      </ol>
    </section>
  );
}
