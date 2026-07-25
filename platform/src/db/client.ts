import { drizzle } from "drizzle-orm/node-postgres";
import { env } from "../config.js";
import { createPgPool } from "./pg-pool.js";
import * as schema from "./schema.js";

const pool = createPgPool(env.DATABASE_URL);

export const db = drizzle(pool, { schema });
export const dbPool = pool;

export async function checkDatabase(): Promise<{ ok: boolean; error?: string }> {
  try {
    await pool.query("select 1");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "database_unreachable",
    };
  }
}
