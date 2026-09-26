import { vi } from 'vitest';

type Result = { data?: unknown; error?: unknown };

/**
 * A tiny stand-in for the Supabase query builder. Every chain method records
 * its call and returns the same builder; awaiting it (or calling single /
 * maybeSingle) resolves with the next queued result for that table.
 */
export function createSupabaseMock() {
  const queues = new Map<string, Result[]>();
  const calls: { table: string; method: string; args: unknown[] }[] = [];

  const next = (table: string): Result => queues.get(table)?.shift() ?? { data: null, error: null };

  const builder = (table: string) => {
    const b: Record<string, unknown> = {};
    for (const method of ['select', 'insert', 'update', 'delete', 'eq', 'in', 'order', 'limit']) {
      b[method] = (...args: unknown[]) => {
        calls.push({ table, method, args });
        return b;
      };
    }
    b.single = () => Promise.resolve(next(table));
    b.maybeSingle = () => Promise.resolve(next(table));
    b.then = (resolve: (r: Result) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(next(table)).then(resolve, reject);
    return b;
  };

  const storageRemove = vi.fn().mockResolvedValue({ error: null });
  const supabase = {
    from: (table: string) => builder(table),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    functions: { invoke: vi.fn() },
    storage: { from: () => ({ remove: storageRemove, upload: vi.fn().mockResolvedValue({ error: null }) }) },
    auth: {
      signInWithPassword: vi.fn(),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      getUser: vi.fn(),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    channel: vi.fn(() => {
      const ch = { on: () => ch, subscribe: () => ch };
      return ch;
    }),
    removeChannel: vi.fn(),
  };

  return {
    supabase,
    storageRemove,
    calls,
    /** Queue the result of the next query on `table`. */
    respond(table: string, result: Result) {
      queues.set(table, [...(queues.get(table) ?? []), result]);
    },
    reset() {
      queues.clear();
      calls.length = 0;
      storageRemove.mockClear();
    },
  };
}
