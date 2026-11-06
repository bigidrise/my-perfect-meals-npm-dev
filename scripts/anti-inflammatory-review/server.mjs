// Isolated real-component browser fixture. No application server imports,
// environment changes, database connection, credentials, or account writes.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "tailwindcss";
import { Client } from "@replit/object-storage";
// Read one existing Development photograph for the synthetic browser fixture.
// No upload, application database import, generator, or Production access.
const imageClient = new Client({ bucketId: "replit-objstore-2a68d585-4c50-4c2e-a7ff-a9973358bc5b" });
const imageListing = await imageClient.list({ prefix: "meal-images/", maxResults: 3 });
if (!imageListing.ok || !imageListing.value.length) throw new Error("No readable Development image fixture");
const imageRead = await imageClient.downloadAsBytes(imageListing.value[1]?.name ?? imageListing.value[0].name);
if (!imageRead.ok) throw new Error("Development image fixture could not be read");
const fixtureImage = imageRead.value[0];
const result = await build({
  entryPoints: ["scripts/anti-inflammatory-review/control.tsx"], bundle: true, write: false,
  format: "iife", platform: "browser", jsx: "automatic",
  alias: { "@": path.resolve("client/src"), "@shared": path.resolve("shared") },
  plugins: [{
    name: "synthetic-api-only",
    setup(builder) {
      builder.onResolve({ filter: /^@\/lib\/apiRequest$/ }, () => ({ path: "fixture-api", namespace: "synthetic" }));
      builder.onResolve({ filter: /^@\/lib\/api$/ }, () => ({ path: "fixture-post", namespace: "synthetic" }));
      builder.onResolve({ filter: /^react-i18next$/ }, () => ({ path: "fixture-i18n", namespace: "synthetic" }));
      builder.onLoad({ filter: /.*/, namespace: "synthetic" }, args => ({
        contents: args.path === "fixture-post" ? "export const post=(...args)=>window.__antiReview.post(...args);"
          : args.path === "fixture-i18n" ? "export const useTranslation=()=>({t:key=>key});"
          : "export const apiRequest=(...args)=>window.__antiReview.request(...args);", loader: "js",
      }));
    },
  }],
});
const raw = [
  "client/src/components/profile/AntiInflammatorySupportControl.tsx",
  "client/src/components/ui/MealImageSlot.tsx", "scripts/anti-inflammatory-review/control.tsx",
].map(file => fs.readFileSync(file, "utf8")).join("\n");
const css = (await postcss([tailwind({ content: [{ raw, extension: "tsx" }] })])
  .process("@tailwind base;@tailwind utilities;", { from: undefined })).css;
const html = `<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}
body{background:#171717;color:white;font:16px system-ui}h1{font-size:22px;margin-bottom:12px}p{margin:12px 0}select{background:#333;color:white;padding:8px;border:1px solid #777}main>section button{padding:8px;border:1px solid #777;border-radius:8px}
</style><div id="root"></div><script src="/fixture.js"></script></html>`;
http.createServer((req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.url?.startsWith("/public-objects/replit-objstore-3ccef")) {
    res.writeHead(503, { "Content-Type": "application/json" }); return res.end('{"error":"Synthetic foreign bucket permission failure"}');
  }
  if (req.url?.startsWith("/public-objects/replit-objstore-2a68")) {
    res.setHeader("Content-Type", fixtureImage[0] === 0xff ? "image/jpeg" : "image/png"); return res.end(fixtureImage);
  }
  if (req.url === "/fixture.js") { res.setHeader("Content-Type", "application/javascript"); return res.end(result.outputFiles[0].text); }
  res.setHeader("Content-Type", "text/html"); res.end(html);
}).listen(8099, "0.0.0.0", () => console.log("Synthetic Anti-Inflammatory real-component fixture on :8099"));
