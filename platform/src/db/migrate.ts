import { config as loadEnv } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import path from "node:path";
import { fileURLToPath } from "node:url";

loadEnv();

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://swift:swift@localhost:55432/swift_platform";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.join(__dirname, "../../drizzle");

async function main() {
  const needsSsl =
    databaseUrl.includes("supabase.co") ||
    databaseUrl.includes("sslmode=require");
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  });
  const db = drizzle(pool);

  console.log("Running migrations from", migrationsFolder);
  await migrate(db, { migrationsFolder });
  console.log("Migrations complete");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
