import type { Metadata } from "next";
import Link from "next/link";
import { getTaxonomy } from "@/lib/taxonomy.server";
import { SubmitForm } from "./SubmitForm";

export const metadata: Metadata = { title: "Submit a business" };
export const dynamic = "force-dynamic";

export default async function SubmitPage() {
  const taxonomy = await getTaxonomy();
  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <nav className="mb-6 text-sm">
        <Link href="/" className="text-[#0d5eaf] underline">
          ← Back to the map
        </Link>
      </nav>
      <h1 className="text-2xl font-semibold text-slate-900">Submit a Greek-owned business</h1>
      <p className="mt-2 text-slate-600">
        Know a Greek-owned business that isn&apos;t on the map? Tell us about it. Every submission is reviewed before it
        appears.
      </p>
      <SubmitForm taxonomy={taxonomy} turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ""} />
    </main>
  );
}
