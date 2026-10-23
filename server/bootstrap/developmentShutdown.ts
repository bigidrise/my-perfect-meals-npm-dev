import type { Server } from "node:http";

type Environment = Record<string, string | undefined>;
type CloseResource = () => void | Promise<void>;
const resources = new Map<string, CloseResource>();

export function developmentShutdownEnabled(env: Environment): boolean {
  return env.NODE_ENV === "development" && !env.REPLIT_DEPLOYMENT;
}

/** Collect cleanup without installing competing Development signal handlers. */
export function registerDevelopmentShutdownResource(name: string, close: CloseResource): () => void {
  resources.set(name, close);
  return () => { resources.delete(name); };
}

/** Development only. Never destroy active connections or force a timed-out exit. */
export function installDevelopmentShutdown(options: {
  env?: Environment;
  server: Server;
  closeVite: CloseResource;
  closeDatabase: CloseResource;
  stopWarmup: CloseResource;
  timeoutMs?: number;
  signals?: Pick<NodeJS.Process, "on" | "removeListener">;
  exit?: (code: number) => void;
  log?: (message: string) => void;
}) {
  const env = options.env ?? process.env;
  if (!developmentShutdownEnabled(env)) return undefined;
  const signals = options.signals ?? process;
  const exit = options.exit ?? ((code: number) => process.exit(code));
  const log = options.log ?? console.log;
  let shuttingDown: Promise<boolean> | undefined;

  const shutdown = (): Promise<boolean> => {
    if (shuttingDown) return shuttingDown;
    shuttingDown = (async () => {
      log("[development-shutdown] Draining HTTP requests; automatic replacement startup must wait for process exit.");
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        // Stop accepting requests immediately. Close only idle keep-alive
        // connections; active requests retain their normal completion path.
        const drained = new Promise<void>((resolve, reject) => {
          options.server.close(error => {
            if (error && (error as NodeJS.ErrnoException).code !== "ERR_SERVER_NOT_RUNNING") reject(error);
            else resolve();
          });
          options.server.closeIdleConnections?.();
        });
        const cleanup = (async () => {
          await options.stopWarmup();
          await drained;
          await options.closeVite();
          for (const close of resources.values()) await close();
          await options.closeDatabase();
        })();
        const result = await Promise.race([
          cleanup.then(() => true),
          new Promise<false>(resolve => {
            timer = setTimeout(() => resolve(false), options.timeoutMs ?? 20_000);
            timer.unref?.();
          }),
        ]);
        if (!result) {
          log("[development-shutdown] Drain timed out; no requests destroyed and no forced exit. Stop activation and inspect the remaining operation.");
          return false;
        }
        log("[development-shutdown] HTTP, Vite, registered resources and database pool closed; exiting cleanly.");
        exit(0);
        return true;
      } catch {
        log("[development-shutdown] Cleanup failed; no forced exit. Stop activation and inspect remaining resources.");
        return false;
      } finally {
        clearTimeout(timer);
      }
    })();
    return shuttingDown;
  };
  const onSignal = () => { void shutdown(); };
  // Keep handlers installed while draining: repeated signals are idempotent,
  // not an accidental fallback to Node's immediate default termination.
  signals.on("SIGTERM", onSignal);
  signals.on("SIGINT", onSignal);
  return {
    shutdown,
    dispose() {
      signals.removeListener("SIGTERM", onSignal);
      signals.removeListener("SIGINT", onSignal);
    },
  };
}
