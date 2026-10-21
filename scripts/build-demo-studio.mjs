/**
 * Client-only, Development-only compilation. No application boot, DB imports,
 * environment mutation, migrations, deployment, or real authentication.
 */
import { build } from "esbuild";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import loadConfig from "tailwindcss/loadConfig.js";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

if (process.env.REPLIT_DEPLOYMENT === "1") {
  throw new Error("Demo Studio assets must not be prepared in a deployment");
}
const outdir = path.resolve("client/.demo-studio-runtime");
await mkdir(outdir, { recursive: true });
const tailwind = loadConfig(path.resolve("tailwind.config.ts"));
const css = await postcss([tailwindcss(tailwind)])
  .process(await readFile("client/src/index.css", "utf8"), { from: "client/src/index.css" });
await writeFile(path.join(outdir, "styles.css"), css.css);
const staticImages = Object.fromEntries(await Promise.all([
  "/icons/chef.png", "/icons/ChefMPMLogo-v2.png", "/images/dashboard-chef-community-hero.png",
  "/images/beverage-creator-bg.jpg", "/images/craving-creator-bg.jpg",
].map(async asset => [asset, `data:image/${asset.endsWith(".jpg") ? "jpeg" : "png"};base64,${(await readFile(`client/public${asset}`)).toString("base64")}`])));
await build({
  entryPoints: ["client/src/demo-studio/bootstrap.ts"], bundle: true,
  outfile: path.join(outdir, "bundle.js"), format: "iife", platform: "browser",
  target: "es2022", minify: true, sourcemap: false, logLevel: "warning",
  alias: { "@": path.resolve("client/src"), "@shared": path.resolve("shared") },
  define: {
    "__MPM_DEMO_STATIC_IMAGES__": JSON.stringify(staticImages),
    "import.meta.env": JSON.stringify({ DEV: true, PROD: false, MODE: "development",
      VITE_SHOW_DEV_TOOLS: "false", VITE_ELEVENLABS_ENABLED: "false", VITE_OPENAI_ENABLED: "false",
      VITE_IS_PRODUCTION_PROJECT: "false" }),
    "process.env.NODE_ENV": JSON.stringify("production"),
    // Route imperative navigation inside the demo as well as wouter navigation.
    // No real Location object is exposed to compiled customer components.
    "window.location": "window.__mpmDemoLocation",
    "document.location": "window.__mpmDemoLocation",
    "location": "window.__mpmDemoLocation",
    "window.location.pathname": "window.__mpmDemoPath",
    "window.location.search": "window.__mpmDemoSearch",
    // Keep the real URL-building helpers working inside an opaque-origin frame.
    // This reserved, non-routable demo origin is consumed only by local adapters.
    "window.location.origin": JSON.stringify("https://demo.invalid"),
  },
  banner: { js: "/* mpm-demo-studio-runtime-v1: Development-only opaque synthetic frame */" },
  loader: { ".png": "dataurl", ".jpg": "dataurl", ".jpeg": "dataurl", ".webp": "dataurl", ".svg": "dataurl", ".mp3": "dataurl" },
});
// Preserve CSS imported by the actual screens as well as their shared Tailwind CSS.
const componentCss = await readFile(path.join(outdir, "bundle.css"), "utf8").catch(() => "");
await writeFile(path.join(outdir, "styles.css"), `${css.css}\n${componentCss}`);
console.log("Demo Studio assets prepared (client only; no application server or database was started).");
