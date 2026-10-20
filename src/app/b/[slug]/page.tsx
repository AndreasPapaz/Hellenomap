import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { BusinessDetail } from "@/components/BusinessDetail";
import { DETAIL_SELECT, toBusinessDetail } from "@/lib/directory";
import { createPublicClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ slug: string }> };

// RLS only returns approved + published businesses to the anon client, so anything else 404s.
const getBusiness = cache(async (slug: string) => {
  const { data } = await createPublicClient().from("businesses").select(DETAIL_SELECT).eq("slug", slug).maybeSingle();
  return data ? toBusinessDetail(data) : null;
});

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const b = await getBusiness((await params).slug);
  if (!b) return { title: "Not found" };
  return {
    title: b.name,
    description: `${b.categories[0]?.name ?? "Greek-owned business"} · ${b.address}`,
  };
}

export default async function BusinessPage({ params }: Params) {
  const b = await getBusiness((await params).slug);
  if (!b) notFound();
  const mapHref = `/?lat=${b.lat}&lng=${b.lng}&z=15&b=${b.slug}`;
  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <nav className="mb-6 text-sm">
        <Link href={mapHref} className="text-[#0d5eaf] underline">
          ← View on map
        </Link>
      </nav>
      <BusinessDetail business={b} />
    </main>
  );
}
