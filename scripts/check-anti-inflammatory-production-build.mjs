import fs from "node:fs";
import path from "node:path";

// Run after production builds. A preview/source assertion cannot detect Vite
// removing a released control through an accidental import.meta.env.DEV gate.
const assets = path.resolve("client/dist/assets");
if (!fs.existsSync(assets)) throw new Error("Build the production frontend before this check.");
const javascript = fs.readdirSync(assets).filter(name => name.endsWith(".js"))
  .map(name => fs.readFileSync(path.join(assets, name), "utf8")).join("\n");
for (const marker of [
  "Enable Anti-Inflammatory support", "Turn off Anti-Inflammatory support",
  "/api/health-context/support/anti_inflammatory",
]) {
  if (!javascript.includes(marker)) throw new Error(`Production UI is missing released support marker: ${marker}`);
}
const server = fs.readFileSync("dist/prod.js", "utf8");
for (const marker of [
  'app.use("/api/health-context/support/anti_inflammatory"',
  "setPersonalAntiInflammatorySupport", "anti_inflammatory_explicit_opt_in",
]) {
  if (!server.includes(marker)) throw new Error(`Production server is missing released support marker: ${marker}`);
}
console.log("Production artifacts retain the released Anti-Inflammatory control, API mount and explicit-choice writer.");
