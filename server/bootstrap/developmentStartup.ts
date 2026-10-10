import { createServer } from "node:net";
import { initializeDevelopmentStartupMaintenance } from "./developmentStartupMaintenance";

export async function assertDevelopmentPortAvailable(port: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const probe = createServer();
    probe.once("error", (error: NodeJS.ErrnoException) => {
      reject(new Error(
        error.code === "EADDRINUSE"
          ? `Port ${port} is occupied. Stop the original Development server before launching; the application was not imported.`
          : `Development port preflight failed (${error.code ?? "unknown"}); the application was not imported.`,
      ));
    });
    probe.once("listening", () => probe.close(error => error ? reject(error) : resolve()));
    probe.listen({ port, host: "0.0.0.0", exclusive: true });
  });
}

export async function runDevelopmentStartup(options: {
  env: Record<string, string | undefined>;
  loadApplication: () => Promise<unknown>;
  checkPort?: (port: number) => Promise<void>;
  log?: (message: string) => void;
}): Promise<void> {
  const mode = initializeDevelopmentStartupMaintenance(options.env);
  const port = options.env.PORT === undefined || options.env.PORT === "" ? 5000 : Number(options.env.PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Invalid Development PORT; the application was not imported.");
  }
  options.log?.(
    `[development-startup] ${mode === "safe-development" ? "SAFE: automatic database maintenance suppressed" : "NORMAL: maintenance enabled"}; mode initialized before application imports.`,
  );
  await (options.checkPort ?? assertDevelopmentPortAvailable)(port);
  await options.loadApplication();
}
