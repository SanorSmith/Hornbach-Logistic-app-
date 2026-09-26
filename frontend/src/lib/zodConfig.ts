import { z } from 'zod';

// Zod otherwise probes whether eval() is allowed when a schema is created,
// which the Content-Security-Policy (vercel.json) forbids. Validation works
// the same without it. Imported first in main.tsx, before any schema exists.
z.config({ jitless: true });
