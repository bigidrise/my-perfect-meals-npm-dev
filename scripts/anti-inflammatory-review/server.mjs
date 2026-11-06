// Isolated real-component browser fixture. No application server imports,
// environment changes, database connection, credentials, or account writes.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "tailwindcss";
const result = await build({
  entryPoints: ["scripts/anti-inflammatory-review/control.tsx"], bundle: true, write: false,
  format: "iife", platform: "browser", jsx: "automatic",
  alias: { "@": path.resolve("client/src") },
  plugins: [{
    name: "synthetic-api-only",
    setup(builder) {
      builder.onResolve({ filter: /^@\/lib\/apiRequest$/ }, () => ({ path: "fixture-api", namespace: "synthetic" }));
      builder.onLoad({ filter: /.*/, namespace: "synthetic" }, () => ({
        contents: "export const apiRequest=(...args)=>window.__antiReview.request(...args);", loader: "js",
      }));
    },
  }],
});
const raw = fs.readFileSync("client/src/components/profile/AntiInflammatorySupportControl.tsx", "utf8");
const css = (await postcss([tailwind({ content: [{ raw, extension: "tsx" }] })])
  .process("@tailwind base;@tailwind utilities;", { from: undefined })).css;
const html = `<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}
body{background:#171717;color:white;font:16px system-ui}h1{font-size:22px;margin-bottom:12px}p{margin:12px 0}select{background:#333;color:white;padding:8px;border:1px solid #777}
</style><div id="root"></div><script src="/fixture.js"></script></html>`;
http.createServer((req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.url === "/fixture.js") { res.setHeader("Content-Type", "application/javascript"); return res.end(result.outputFiles[0].text); }
  res.setHeader("Content-Type", "text/html"); res.end(html);
}).listen(8099, "0.0.0.0", () => console.log("Synthetic Anti-Inflammatory real-component fixture on :8099"));
