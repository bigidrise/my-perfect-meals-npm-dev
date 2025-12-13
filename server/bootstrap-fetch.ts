// server/bootstrap-fetch.ts
// Load environment variables FIRST before anything else
import { config } from "dotenv";
config();

// Ensures fetch is available in Node.js < 18 environments
// Safe no-op on Node.js 18+ where fetch is built-in

const nodeMajorVersion = parseInt(process.version.slice(1).split('.')[0]);

if (nodeMajorVersion < 18 && !(globalThis as any).fetch) {
  try {
    const { fetch: undiciFetch, Headers, Request, Response } = require("undici");
    (globalThis as any).fetch = undiciFetch;
    (globalThis as any).Headers = Headers;
    (globalThis as any).Request = Request;
    (globalThis as any).Response = Response;
    console.log("✅ Fetch polyfill loaded for Node.js < 18");
  } catch (error) {
    console.warn("⚠️ Could not load fetch polyfill - install undici for Node.js < 18");
  }
}