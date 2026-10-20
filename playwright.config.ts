import { defineConfig, devices } from "@playwright/test";
import { loadLocalSupabaseEnv } from "./scripts/lib/local-env";

const PORT = Number(process.env.E2E_PORT ?? 3100);
loadLocalSupabaseEnv();

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // A production build avoids dev-server full reloads while tests type into forms.
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: {
      NEXT_PUBLIC_E2E: "1",
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      // Cloudflare's always-pass test keys.
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "1x00000000000000000000AA",
      TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY ?? "1x0000000000000000000000000000000AA",
      ADMIN_EMAILS: process.env.ADMIN_EMAILS ?? "owner@example.com",
      IP_HASH_SALT: process.env.IP_HASH_SALT ?? "e2e-salt",
    },
  },
});
