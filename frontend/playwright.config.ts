import { defineConfig, devices } from '@playwright/test';

// End-to-end tests of the real app in a browser. Supabase is never contacted:
// the app is started with a fake Supabase URL and every request to it is
// answered by e2e/fakeSupabase.ts.
// E2E_CSP=1: test a production build served with the Content-Security-Policy
// from vercel.json (see e2e/cspServer.mjs) instead of the dev server.
const CSP = !!process.env.E2E_CSP;
const PORT = CSP ? 5175 : 5174;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    serviceWorkers: 'block', // the PWA service worker would bypass request interception
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: CSP
      ? 'npx vite build --outDir dist-csp --emptyOutDir && node e2e/cspServer.mjs'
      : `npx vite --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      VITE_SUPABASE_URL: 'http://supabase.test',
      VITE_SUPABASE_ANON_KEY: 'e2e-anon-key',
      PORT: String(PORT),
    },
  },
});
