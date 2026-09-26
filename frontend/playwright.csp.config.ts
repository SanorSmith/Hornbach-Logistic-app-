// Same tests, but against a production build served with the
// Content-Security-Policy from vercel.json (see e2e/cspServer.mjs).
// Separate config file so `npm run test:e2e:csp` works on Windows too.
process.env.E2E_CSP = '1';

const { default: config } = await import('./playwright.config');
export default config;
