import { spawn } from "node:child_process";
import { isolatedEnvironment, verifyIsolatedDatabase } from "./target.mjs";

// Existing workspace mapping: local 4179 → external 8080. Never bind the
// main application's port 5000, even when this launcher is run without flags.
const port = "4179";
const browserOrigin = `https://${process.env.REPLIT_DEV_DOMAIN}:8080`;
if (!process.env.REPLIT_DEV_DOMAIN?.endsWith(".replit.dev")) {
  throw new Error("Founder preview requires a verified Development hostname.");
}
const client = await verifyIsolatedDatabase();
try {
  const { rows } = await client.query(`SELECT
    to_regclass('public.users') IS NOT NULL AND
    to_regclass('public.shopping_list_items') IS NOT NULL AND
    to_regclass('public.shopping_transfer_cycles') IS NOT NULL AND
    to_regclass('public.shopping_transfer_receipts') IS NOT NULL AND
    to_regclass('public.shopping_transfer_contributions') IS NOT NULL AS ready`);
  if (!rows[0]?.ready) throw new Error("Isolated founder schema is not ready; refusing application startup.");
} finally { await client.end(); }

console.log("[shopping-isolation] Verified local cluster, founder database and Shopping schema. Shared DB is not a fallback.");
const child = spawn(process.execPath, [
  "--import", new URL("./guard.mjs", import.meta.url).href,
  "--import", "tsx", "server/devBootstrap.ts",
], {
  stdio: "inherit",
  env: isolatedEnvironment({
    NODE_ENV: "development", PORT: port,
    // Existing exact-origin configuration, confined to this child process.
    // The secondary external port is not the main preview origin.
    APP_ORIGIN: browserOrigin,
    DEVELOPMENT_SAFE_RESTART: "true",
    SKIP_DEVELOPMENT_ACCOUNT_MAINTENANCE: "true",
    IMAGE_DEVELOPMENT_ACTIVATION: "approved-flare",
    MEAL_SHOPPING_TRANSFERS_ENABLED: "true",
  }),
});
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => child.kill(signal));
child.on("exit", code => { process.exitCode = code ?? 1; });
