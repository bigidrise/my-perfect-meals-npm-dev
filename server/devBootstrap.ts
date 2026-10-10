// Only environment loading and the dependency-free Development startup policy
// are static imports. Never add routes, db, workers or services here.
import dotenv from "dotenv";
import { runDevelopmentStartup } from "./bootstrap/developmentStartup";

dotenv.config({ quiet: true });

void runDevelopmentStartup({
  env: process.env,
  log: message => console.log(message),
  loadApplication: () => import("./index"),
}).catch((error: unknown) => {
  console.error("[development-startup] Aborted:", error instanceof Error ? error.message : "startup failed");
  process.exitCode = 1;
});
