import { defineConfig, devices } from '@playwright/test';

// End-to-end tests of the real app in a browser. Supabase is never contacted:
// the app is started with a fake Supabase URL and every request to it is
// answered by e2e/fakeSupabase.ts.
const PORT = 5174;

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
    command: `npx vite --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_SUPABASE_URL: 'http://supabase.test',
      VITE_SUPABASE_ANON_KEY: 'e2e-anon-key',
    },
  },
});
