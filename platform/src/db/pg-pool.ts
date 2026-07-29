import pg from "pg";

/** Supabase / Railway / hosted Postgres: force SSL off localhost. */
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
    const host = u.hostname.toLowerCase();
    const local =
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host.endsWith(".local");
    if (!local) forcedSsl = true;
    cleaned = u.toString();
  } catch {
    forcedSsl =
      connectionString.includes("supabase") ||
      connectionString.includes("sslmode=require") ||
      (!connectionString.includes("localhost") &&
        !connectionString.includes("127.0.0.1"));
    cleaned = connectionString.replace(/[?&]sslmode=[^&]*/g, "");
  }

  return new pg.Pool({
    connectionString: cleaned,
    ...(forcedSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  });
}
