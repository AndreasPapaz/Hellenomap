import "server-only";
import { toTaxonomy, type Taxonomy } from "./directory";
import { createPublicClient } from "./supabase/server";

export async function getTaxonomy(): Promise<Taxonomy> {
  const { data, error } = await createPublicClient()
    .from("category_groups")
    .select("slug, name, categories(slug, name, sort)")
    .order("sort");
  if (error) throw error;
  return toTaxonomy(data);
}
