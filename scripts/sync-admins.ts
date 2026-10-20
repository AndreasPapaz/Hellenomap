// Makes the `admins` table match ADMIN_EMAILS (comma-separated).
//   ADMIN_EMAILS=you@example.com npm run admins:sync
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/supabase/database.types";
import { loadLocalSupabaseEnv } from "./lib/local-env";

async function main() {
  loadLocalSupabaseEnv();
  const emails = [...new Set((process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean))];
  if (emails.length === 0) {
    console.error("ADMIN_EMAILS is empty; refusing to remove every admin.");
    process.exit(1);
  }
  const db = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  const up = await db.from("admins").upsert(emails.map((email) => ({ email })));
  if (up.error) throw up.error;
  const del = await db.from("admins").delete().not("email", "in", `(${emails.map((e) => `"${e}"`).join(",")})`);
  if (del.error) throw del.error;
  console.log(`Admins: ${emails.join(", ")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
