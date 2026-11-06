import express from "express";
import fs from "node:fs";
import path from "node:path";
import antiInflammatorySupportRouter from "../../server/routes/antiInflammatorySupport";
import { csrfProtection } from "../../server/lib/csrfProtection";
import { fixtureStore } from "./productionDependencies";

if (process.env.NODE_ENV !== "production" || process.env.REPLIT_DEPLOYMENT !== "1") {
  throw new Error("This isolated fixture must exercise production/published mode");
}
const app = express();
app.use(express.json());
app.use((req: any, _res, next) => {
  const account = /(?:^|;\s*)fixtureAccount=(synthetic-[ab])(?:;|$)/.exec(req.headers.cookie ?? "")?.[1];
  if (account) req.session = { userId: account, csrfToken: "offline-fixture-csrf" };
  next();
});
app.use(csrfProtection);
app.use("/api/health-context/support/anti_inflammatory", antiInflammatorySupportRouter());
app.get("/__fixture/state", (_req, res) => res.json({
  nodeEnv: process.env.NODE_ENV, deployment: process.env.REPLIT_DEPLOYMENT,
  sources: fixtureStore.sources, preferences: [...fixtureStore.preferences],
}));
app.use("/api", (_req, res) => res.status(404).json({ error: "Not exposed in isolated fixture" }));
const root = path.resolve("generated-artifacts/anti-inflammatory-production-review");
app.get("/fixture.js", (_req, res) => res.type("js").send(fs.readFileSync(path.join(root, "fixture.js"))));
app.get("*", (_req, res) => res.type("html").send(fs.readFileSync(path.join(root, "index.html"))));
app.listen(8099, "0.0.0.0", () => console.log("Isolated production-mode Anti-Inflammatory fixture ready on :8099"));
