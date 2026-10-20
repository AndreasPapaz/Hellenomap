// Fills Supabase env vars from the running local stack (`supabase status`) when they
// aren't already set, so local scripts and tests don't need a .env file.
import { execSync } from "node:child_process";

export function loadLocalSupabaseEnv(): boolean {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return true;
  try {
    const out = execSync("npx supabase status -o json", { stdio: ["ignore", "pipe", "ignore"] }).toString();
    const s = JSON.parse(out) as Record<string, string>;
    process.env.NEXT_PUBLIC_SUPABASE_URL ??= s.API_URL;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= s.ANON_KEY;
    process.env.SUPABASE_SERVICE_ROLE_KEY ??= s.SERVICE_ROLE_KEY;
    process.env.SUPABASE_DB_URL ??= s.DB_URL;
    return true;
  } catch {
    return false;
  }
}
