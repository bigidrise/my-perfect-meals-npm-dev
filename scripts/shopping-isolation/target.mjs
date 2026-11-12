import pg from "pg";
import { resolve } from "node:path";

// Fixed local target. Never accept DATABASE_URL or a fallback from the caller.
export const isolatedDirectory = resolve(".local/shopping-isolated/postgres");
export const isolatedUrl = "postgresql://runner@127.0.0.1:55432/mpm_shopping_founder_isolated";
export function isolatedEnvironment(extra = {}) {
  if (process.env.REPLIT_DEPLOYMENT === "1" || process.env.REPLIT_DEPLOYMENT === "true") {
    throw new Error("Shopping isolation cannot run in a published deployment.");
  }
  return { ...process.env, ...extra, DATABASE_URL: isolatedUrl,
    PGHOST: "127.0.0.1", PGPORT: "55432", PGDATABASE: "mpm_shopping_founder_isolated",
    PGUSER: "runner", PGPASSWORD: "" };
}
export async function verifyIsolatedDatabase(database = "mpm_shopping_founder_isolated") {
  if (!["postgres", "mpm_shopping_founder_isolated"].includes(database) &&
      !/^mpm_shopping_concurrency_[a-f0-9]{12}$/.test(database)) throw new Error("Unapproved database");
  isolatedEnvironment();
  const client = new pg.Client({ host: "127.0.0.1", port: 55432, user: "runner", database,
    connectionTimeoutMillis: 3000 });
  try {
    await client.connect();
    const { rows } = await client.query(`SELECT current_database() AS database,
      current_setting('data_directory') AS directory, host(inet_server_addr()) AS address`);
    if (rows[0].database !== database || rows[0].directory !== isolatedDirectory ||
        rows[0].address !== "127.0.0.1") throw new Error("Isolation identity verification failed");
    return client;
  } catch (error) { await client.end().catch(() => undefined); throw error; }
}
