import pg from "pg";
import { verifyIsolatedDatabase } from "./target.mjs";

// Runs before any application imports. Even a separately constructed pg client
// must remain in the exact verified local database.
const probe = await verifyIsolatedDatabase();
await probe.end();
const connect = pg.Client.prototype.connect;
pg.Client.prototype.connect = function (...args) {
  const p = this.connectionParameters;
  if (p.host !== "127.0.0.1" || Number(p.port) !== 55432 ||
      p.database !== "mpm_shopping_founder_isolated") {
    throw new Error("ISOLATION_GUARD: refused a PostgreSQL connection outside the founder database");
  }
  return connect.apply(this, args);
};
console.log("[shopping-isolation] PostgreSQL connection allowlist installed before application imports.");
