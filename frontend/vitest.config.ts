import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Unit and component tests. Nothing here talks to the real Supabase project:
// tests that need the client mock ../lib/supabase, and the URL/key below are
// placeholders so the module can load.
export default defineConfig({
  plugins: [react()],
  server: { fs: { allow: ['..'] } },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Edge-function helpers without Deno-only runtime imports are tested here too.
    include: ['src/**/*.test.{ts,tsx}', '../supabase/functions/**/*.test.ts'],
    env: {
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/types/**', 'src/main.tsx'],
      reporter: ['text-summary', 'text'],
    },
  },
});
