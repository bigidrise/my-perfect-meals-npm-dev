// Keep Vite's compile-time gate intact; portable component tests mock this module.
export const isDevelopmentRuntime = import.meta.env.DEV;
