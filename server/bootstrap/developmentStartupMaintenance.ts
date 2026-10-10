type StartupEnvironment = Record<string, string | undefined>;
export type DevelopmentStartupMode = "normal" | "safe-development";
let initializedMode: DevelopmentStartupMode | undefined;

function isProductionRuntime(env: StartupEnvironment): boolean {
  return env.NODE_ENV === "production" || Boolean(env.REPLIT_DEPLOYMENT);
}

// Client branding flags are deliberately NOT server-runtime authority.
export function resolveStartupMaintenanceMode(env: StartupEnvironment): DevelopmentStartupMode {
  if (isProductionRuntime(env)) return "normal";
  const request = env.DEVELOPMENT_SAFE_RESTART;
  if (request === undefined || request === "" || request === "false") return "normal";
  if (request !== "true") {
    throw new Error("DEVELOPMENT_SAFE_RESTART must be true or false; refusing ambiguous startup.");
  }
  if (env.NODE_ENV !== "development") {
    throw new Error("Safe restart requires the explicit Development bootstrap.");
  }
  return "safe-development";
}

/** Called before dynamically importing any application module. */
export function initializeDevelopmentStartupMaintenance(
  env: StartupEnvironment = process.env,
): DevelopmentStartupMode {
  if (env.NODE_ENV !== "development" || isProductionRuntime(env)) {
    throw new Error("The Development bootstrap refuses Production or deployed runtimes.");
  }
  const mode = resolveStartupMaintenanceMode(env);
  if (initializedMode !== undefined && initializedMode !== mode) {
    throw new Error("Development startup mode is already initialized and cannot be changed.");
  }
  initializedMode = mode;
  return mode;
}

/**
 * Automatic launch sites only. Never gate authentication, authorization,
 * clinical validation or interactive request writes with this policy.
 */
export function startupMaintenanceEnabled(
  env: StartupEnvironment = process.env,
): boolean {
  // Shared route modules still start their Production workers normally.
  if (isProductionRuntime(env)) return true;
  if (initializedMode !== undefined) return initializedMode === "normal";
  if (resolveStartupMaintenanceMode(env) === "safe-development") {
    // A direct index.ts launch must not silently bypass pre-import initialization.
    throw new Error("Safe restart was not initialized. Use DEVELOPMENT_SAFE_RESTART=true npm run dev.");
  }
  return true;
}
