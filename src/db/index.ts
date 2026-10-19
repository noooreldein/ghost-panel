import { drizzle } from "drizzle-orm/node-postgres";
import { Client, Pool } from "pg";

/**
 * Ghost Panel stores its operational data in Supabase Postgres. Use the
 * Session Pooler URI for a persistent Node server, or the Transaction Pooler
 * URI when deploying to serverless infrastructure.
 */
/**
 * Lazy, build-safe connection: the pool is created on first query, not at
 * module import. Next.js evaluates route modules during `next build` (page
 * data collection) where SUPABASE_DB_URL may not exist yet; the hard error
 * is deferred to actual runtime use instead of breaking the build.
 */
const globalForDb = globalThis as typeof globalThis & { __ghostSupabasePool?: Pool };

function createPool(): Pool {
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) throw new Error("SUPABASE_DB_URL is required. Copy it from Supabase Dashboard > Connect.");
  const isSupabase = /(?:\.supabase\.co|\.pooler\.supabase\.com)/i.test(connectionString);
  const poolSize = Math.max(1, Math.min(Number(process.env.DB_POOL_MAX ?? 5) || 5, 20));
  // Optional schema isolation (e.g. sharing a Supabase instance with another
  // app): all unqualified table names resolve inside this schema.
  const schemaName = process.env.DB_SCHEMA?.trim() ?? "";
  const validSchema = /^[A-Za-z_][A-Za-z0-9_]*$/.test(schemaName) ? schemaName : "";
  // Apply search_path via the pool's onConnect hook (pg-pool): runs once per
  // new connection BEFORE the client is handed to any waiter — race-free and
  // safer than the `options` startup parameter, which some poolers reject.
  const p = new Pool({
    connectionString,
    max: poolSize,
    ssl: isSupabase ? { rejectUnauthorized: process.env.SUPABASE_SSL_REJECT_UNAUTHORIZED !== "false" } : undefined,
    ...(validSchema
      ? {
          onConnect: async (client: Client): Promise<void> => {
            await client.query(`SET search_path TO "${validSchema}"`);
          },
        }
      : {}),
  } as never as import("pg").PoolConfig & Record<string, unknown>);
  globalForDb.__ghostSupabasePool = p;
  return p;
}

/** Shared pg Pool (created lazily, memoized across dev reloads). */
export const pool: Pool = new Proxy({} as Pool, {
  get(_t, prop, receiver) {
    const real = globalForDb.__ghostSupabasePool ?? createPool();
    const value = Reflect.get(real as object, prop, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

const globalForDrizzle = globalThis as typeof globalThis & { __ghostSupabaseDb?: ReturnType<typeof drizzle> };
export const db = globalForDrizzle.__ghostSupabaseDb ?? drizzle(pool);
if (process.env.NODE_ENV !== "production") globalForDrizzle.__ghostSupabaseDb = db;
