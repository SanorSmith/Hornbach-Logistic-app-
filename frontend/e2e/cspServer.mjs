// Serves a production build with the Content-Security-Policy from vercel.json,
// pointed at the fake Supabase host, so the e2e tests can prove the CSP does
// not block anything the app needs. Used by `npm run test:e2e:csp`.
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const root = new URL('../dist-csp/', import.meta.url).pathname;
const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const csp = vercel.headers
  .flatMap((h) => h.headers)
  .find((h) => h.key === 'Content-Security-Policy')
  .value.replace(/https:\/\/[a-z0-9]+\.supabase\.co/g, 'http://supabase.test')
  .replace(/wss:\/\/[a-z0-9]+\.supabase\.co/g, 'ws://supabase.test');

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };

createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
  let file = join(root, path);
  if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) file = join(root, 'index.html');
  res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Content-Security-Policy': csp });
  res.end(readFileSync(file));
}).listen(Number(process.env.PORT ?? 5175));
