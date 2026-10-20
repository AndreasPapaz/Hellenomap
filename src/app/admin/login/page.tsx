import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Owner sign in", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-semibold">Owner sign in</h1>
      <p className="mt-2 text-slate-600">We&apos;ll email you a sign-in link.</p>
      {error === "link" && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-red-800">
          That sign-in link is invalid or has expired. Request a new one.
        </p>
      )}
      <LoginForm />
    </main>
  );
}
