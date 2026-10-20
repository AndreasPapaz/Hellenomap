import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import { loadLocalSupabaseEnv } from "./scripts/lib/local-env";

const nextConfig: NextConfig = {};

/**
 * `npm run dev` works without a .env.local: it falls back to the local Supabase stack and
 * Cloudflare's always-pass Turnstile test keys. Anything set in .env.local takes precedence.
 * Dev only — production builds read their environment as usual.
 */
function localDevEnv(): Record<string, string> {
  if (!loadLocalSupabaseEnv()) {
    console.warn("⚠ Supabase isn't configured: run `npx supabase start` or set the variables in .env.local.");
    return {};
  }
  const keys = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"] as const;
  return {
    ...Object.fromEntries(keys.map((k) => [k, process.env[k]!])),
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "1x00000000000000000000AA",
    TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY ?? "1x0000000000000000000000000000000AA",
    IP_HASH_SALT: process.env.IP_HASH_SALT ?? "local-dev-salt",
  };
}

export default function config(phase: string): NextConfig {
  return phase === PHASE_DEVELOPMENT_SERVER ? { ...nextConfig, env: localDevEnv() } : nextConfig;
}
