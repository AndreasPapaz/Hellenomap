import { MapExplorer } from "@/components/map/MapExplorer";
import { getTaxonomy } from "@/lib/taxonomy.server";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  const [taxonomy, params] = await Promise.all([getTaxonomy(), searchParams]);
  const search = new URLSearchParams(
    Object.entries(params).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k, x]) : [[k, v]])),
  ).toString();
  return (
    <main>
      <h1 className="sr-only">Hellenomap — Greek-owned businesses near you</h1>
      <MapExplorer taxonomy={taxonomy} initialSearch={search} />
    </main>
  );
}
