import { assertDevelopmentPortAvailable } from "./developmentStartup";
import { initializeProductionPreviewStartupMaintenance } from "./developmentStartupMaintenance";

export async function runProductionPreviewStartup(options: {
  env: Record<string, string | undefined>;
  loadApplication: () => Promise<unknown>;
  checkPort?: (port: number) => Promise<void>;
  log?: (message: string) => void;
}): Promise<void> {
  initializeProductionPreviewStartupMaintenance(options.env);
  const port = options.env.PORT === undefined || options.env.PORT === "" ? 5000 : Number(options.env.PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Invalid Production preview PORT; the application was not imported.");
  }
  options.log?.(
    "[production-preview-startup] DIAGNOSTIC: automatic migrations, seeding, recovery, schedules and workers suppressed before application imports; security and read-only readiness remain active.",
  );
  await (options.checkPort ?? assertDevelopmentPortAvailable)(port);
  await options.loadApplication();
}
