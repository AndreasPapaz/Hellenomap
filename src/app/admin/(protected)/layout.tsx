import type { Metadata } from "next";
import Link from "next/link";
import { getAdmin } from "@/lib/admin.server";
import { signOut } from "../login/actions";

export const metadata: Metadata = { title: "Moderation", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdmin();
  if (!admin) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center" data-testid="admin-denied">
        <h1 className="text-2xl font-semibold">Not authorized</h1>
        <p className="mt-2 text-slate-600">This account doesn&apos;t have access to moderation.</p>
        <form action={signOut} className="mt-6">
          <button className="text-[#0d5eaf] underline">Sign out</button>
        </form>
      </main>
    );
  }
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/admin" className="font-semibold">
            Hellenomap moderation
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link href="/admin" className="underline-offset-4 hover:underline">
              Pending
            </Link>
            <Link href="/admin/rejected" className="underline-offset-4 hover:underline">
              Rejected
            </Link>
            <Link href="/admin/businesses" className="underline-offset-4 hover:underline">
              All businesses
            </Link>
            <Link href="/" className="underline-offset-4 hover:underline">
              Public map
            </Link>
          </nav>
          <form action={signOut} className="ml-auto flex items-center gap-3 text-sm text-slate-600">
            <span>{admin.email}</span>
            <button className="underline">Sign out</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
