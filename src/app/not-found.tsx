import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold">Not found</h1>
      <p className="mt-2 text-slate-600">This page doesn&apos;t exist or the business isn&apos;t listed.</p>
      <Link href="/" className="mt-6 inline-block text-[#0d5eaf] underline">
        Back to the map
      </Link>
    </main>
  );
}
