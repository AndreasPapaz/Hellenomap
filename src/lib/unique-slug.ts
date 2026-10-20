import type { SupabaseClient } from "@supabase/supabase-js";
import { slugify } from "./slug";
import type { Database } from "./supabase/database.types";

/** First free slug among `base`, `base-2`, `base-3`, … (needs a client that can see all businesses). */
export async function uniqueSlug(db: SupabaseClient<Database>, name: string): Promise<string> {
  const base = slugify(name);
  const { data, error } = await db.from("businesses").select("slug").like("slug", `${base}%`);
  if (error) throw error;
  const taken = new Set(data.map((r) => r.slug));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}
