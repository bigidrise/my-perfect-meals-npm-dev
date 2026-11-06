// Offline production compilation only. Never imports application bootstraps.
import { build } from "esbuild";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import postcss from "postcss";
import tailwind from "tailwindcss";

const out = "generated-artifacts/anti-inflammatory-production-review";
await fs.mkdir(out, { recursive: true });
const dependencies = path.resolve("scripts/anti-inflammatory-review/productionDependencies.ts");
await build({
  entryPoints: ["scripts/anti-inflammatory-review/productionServer.ts"],
  bundle: true, platform: "node", packages: "external", format: "esm", outfile: `${out}/server.mjs`,
  plugins: [{ name: "offline-storage-and-identity", setup(builder) {
    builder.onResolve({ filter: /^(?:\.\.\/)+db$/ }, () => ({ path: dependencies }));
    builder.onResolve({ filter: /\/middleware\/requireAuth$/ }, () => ({ path: dependencies }));
    builder.onResolve({ filter: /\/resolveHealthProtocolState$/ }, () => ({ path: "blocked-clinical", namespace: "offline" }));
    builder.onLoad({ filter: /.*/, namespace: "offline" }, () => ({
      contents: 'export function resolveHealthProtocolState(){throw new Error("Experimental clinical resolution is not part of this fixture")}',
    }));
  } }],
});
await build({
  entryPoints: ["scripts/anti-inflammatory-review/productionClient.tsx"], bundle: true, minify: true,
  platform: "browser", format: "iife", jsx: "automatic", outfile: `${out}/fixture.js`,
  alias: { "@": path.resolve("client/src"), "@shared": path.resolve("shared") },
  define: { "import.meta.env.DEV": "false", "process.env.NODE_ENV": '"production"' },
  plugins: [{ name: "real-isolated-http", setup(builder) {
    builder.onResolve({ filter: /^@\/lib\/apiRequest$/ }, () => ({ path: "fixture-http", namespace: "offline" }));
    builder.onLoad({ filter: /.*/, namespace: "offline" }, () => ({
      contents: `export async function apiRequest(url, options={}) {
        const response=await fetch(url,{...options,credentials:"same-origin",
          headers:{"Content-Type":"application/json","x-csrf-token":"offline-fixture-csrf",...options.headers}});
        if(!response.ok) throw new Error("Isolated HTTP "+response.status);
        return response.json();
      }`,
    }));
  } }],
});
const raw = await fs.readFile("client/src/components/profile/AntiInflammatorySupportControl.tsx", "utf8");
const css = (await postcss([tailwind({ content: [{ raw, extension: "tsx" }] })])
  .process("@tailwind base;@tailwind utilities;", { from: undefined })).css;
await fs.writeFile(`${out}/index.html`, `<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}
body{background:#171717;color:white;font:16px system-ui}h1{font-size:23px}h2{font-size:19px}p,nav,select{margin:16px 0}select{background:#333;padding:8px}a{color:#93c5fd}</style>
<div id="root"></div><script src="/fixture.js"></script></html>`);
const child = spawn(process.execPath, [`${out}/server.mjs`], {
  env: { ...process.env, NODE_ENV: "production", REPLIT_DEPLOYMENT: "1" }, stdio: "inherit",
});
process.on("SIGTERM", () => child.kill("SIGTERM"));
process.on("SIGINT", () => child.kill("SIGINT"));
child.on("exit", code => process.exit(code ?? 1));
