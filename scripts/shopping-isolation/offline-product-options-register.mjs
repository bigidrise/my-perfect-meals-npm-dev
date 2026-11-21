import { register } from "node:module";
import net from "node:net";
import { verifyIsolatedDatabase } from "./target.mjs";

if (process.env.PORT !== "4179" || process.env.SHOPPING_OFFLINE_PRODUCT_FIXTURES !== "true" ||
    process.env.NODE_ENV !== "development" || process.env.REPLIT_DEPLOYMENT) {
  throw new Error("Offline providers require the approved isolated Development instance.");
}
const connection = await verifyIsolatedDatabase();
await connection.end();

// This applies only to the isolated child, before any application imports.
// Never reach shared PostgreSQL, Stripe, LLMs, catalog APIs, mail or telemetry.
const originalConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const first = Array.isArray(args[0]) ? args[0][0] : args[0];
  const options = first && typeof first === "object" ? first : { port: first, host: args[1] };
  const host = options.host || "localhost";
  if (!["127.0.0.1", "localhost", "::1"].includes(host) || ![55432, 4179].includes(Number(options.port))) {
    throw new Error("SHOPPING_OFFLINE_GUARD: outbound connection refused");
  }
  return originalConnect.apply(this, args);
};
globalThis.fetch = async () => { throw new Error("SHOPPING_OFFLINE_GUARD: external fetch refused"); };
register("./offline-product-options-loader.mjs", import.meta.url);
console.log("[shopping-offline] Outbound network blocked; only isolated PostgreSQL and self HTTP sockets are allowed.");
