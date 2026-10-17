// Keep application, database, routes and services behind the dynamic import.
import dotenv from "dotenv";
import { runProductionPreviewStartup } from "./bootstrap/productionPreviewStartup";

dotenv.config({ quiet: true });

void runProductionPreviewStartup({
  env: process.env,
  log: message => console.log(message),
  loadApplication: () => import("./prod"),
}).catch((error: unknown) => {
  console.error("[production-preview-startup] Aborted:", error instanceof Error ? error.message : "startup failed");
  process.exitCode = 1;
});
