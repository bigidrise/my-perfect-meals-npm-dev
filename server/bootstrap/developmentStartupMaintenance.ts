type StartupEnvironment = Record<string, string | undefined>;
export type DevelopmentStartupMode = "normal" | "safe-development" | "safe-production-preview";
let initializedMode: DevelopmentStartupMode | undefined;

function isProductionRuntime(env: StartupEnvironment): boolean {
  return env.NODE_ENV === "production" || Boolean(env.REPLIT_DEPLOYMENT);
}

function isPermittedPreviewHostname(hostname: string | undefined): boolean {
  if (!hostname || hostname.length > 253 || !hostname.toLowerCase().endsWith(".replit.dev")) {
    return false;
  }
  return hostname.split(".").every(label =>
    label.length > 0 && label.length <= 63 &&
    !/[^a-z0-9-]/i.test(label) && !label.startsWith("-") && !label.endsWith("-"),
  );
}

function isProductionWorkspacePreview(env: StartupEnvironment): boolean {
  return env.NODE_ENV === "production" &&
    !env.REPLIT_DEPLOYMENT &&
    isPermittedPreviewHostname(env.REPLIT_DEV_DOMAIN);
}

// Client branding flags are deliberately NOT server-runtime authority.
export function resolveStartupMaintenanceMode(env: StartupEnvironment): DevelopmentStartupMode {
  // Published runtime authority takes precedence over every preview switch.
  if (env.REPLIT_DEPLOYMENT) return "normal";
  const diagnosticRequest = env.PRODUCTION_PREVIEW_SAFE_START;
  if (diagnosticRequest !== undefined && diagnosticRequest !== "" && diagnosticRequest !== "false") {
    if (diagnosticRequest !== "true" || !isProductionWorkspacePreview(env)) {
      throw new Error("PRODUCTION_PREVIEW_SAFE_START requires true and an unpublished Production workspace preview.");
    }
    return "safe-production-preview";
  }
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

/** Dedicated preview launcher only; never initialize this after app imports. */
export function initializeProductionPreviewStartupMaintenance(
  env: StartupEnvironment = process.env,
): DevelopmentStartupMode {
  const mode = resolveStartupMaintenanceMode(env);
  if (mode !== "safe-production-preview") {
    throw new Error("The Production preview bootstrap requires explicit diagnostic mode and refuses published runtimes.");
  }
  if (initializedMode !== undefined && initializedMode !== mode) {
    throw new Error("Startup mode is already initialized and cannot be changed.");
  }
  initializedMode = mode;
  return mode;
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
  // Never suppress normal published operations, including after a mode was
  // initialized in an isolated test or if a preview flag is inherited.
  if (env.REPLIT_DEPLOYMENT) return true;
  if (initializedMode === "safe-production-preview") {
    if (!isProductionWorkspacePreview(env)) {
      throw new Error("Diagnostic startup runtime identity changed; refusing ambiguous maintenance policy.");
    }
    return false;
  }
  if (resolveStartupMaintenanceMode(env) === "safe-production-preview") {
    throw new Error("Diagnostic startup was not initialized. Use server/prodPreviewBootstrap.ts.");
  }
  // Shared route modules still start their Production workers normally.
  if (isProductionRuntime(env)) return true;
  if (initializedMode !== undefined) return initializedMode === "normal";
  if (resolveStartupMaintenanceMode(env) === "safe-development") {
    // A direct index.ts launch must not silently bypass pre-import initialization.
    throw new Error("Safe restart was not initialized. Use DEVELOPMENT_SAFE_RESTART=true npm run dev.");
  }
  return true;
}
