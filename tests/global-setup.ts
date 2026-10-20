import { loadLocalSupabaseEnv } from "../scripts/lib/local-env";

export default function setup() {
  process.env.HAS_LOCAL_SUPABASE = loadLocalSupabaseEnv() ? "1" : "";
}
