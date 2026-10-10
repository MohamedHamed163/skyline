import "server-only";
import postgres from "postgres";

// One shared Postgres client per server instance. DATABASE_URL is set by the
// Neon integration on Vercel; pull it locally with `vercel env pull`.

const g = globalThis as { __skylineSql?: postgres.Sql };

export function sql() {
  if (!g.__skylineSql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set. Run `vercel env pull` to fetch it.");
    g.__skylineSql = postgres(url, {
      ssl: "require",
      max: 5,
      idle_timeout: 20,
      // Neon's pooled connection string goes through PgBouncer, which has no prepared statements.
      prepare: false,
    });
  }
  return g.__skylineSql;
}
