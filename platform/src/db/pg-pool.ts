import pg from "pg";

/** Supabase / hosted Postgres: force SSL without rejecting pooler certs. */
export function createPgPool(connectionString: string): pg.Pool {
  let cleaned = connectionString;
  let forcedSsl = false;

  try {
    const u = new URL(connectionString);
    const sslMode = u.searchParams.get("sslmode");
    if (sslMode) {
      forcedSsl = sslMode === "require" || sslMode === "verify-full";
      u.searchParams.delete("sslmode");
    }
    if (u.hostname.includes("supabase")) forcedSsl = true;
    cleaned = u.toString();
  } catch {
    forcedSsl =
      connectionString.includes("supabase") ||
      connectionString.includes("sslmode=require");
    cleaned = connectionString.replace(/[?&]sslmode=[^&]*/g, "");
  }

  return new pg.Pool({
    connectionString: cleaned,
    ...(forcedSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  });
}
