/**
 * Jest stub for @/lib/sentry.
 *
 * sentry.ts uses `import.meta.env` which Jest (CommonJS/Node runner) cannot
 * parse.  Any test suite that transitively imports sentry — typically through
 * AuthContext — gets this no-op stub instead, so the suite can run without
 * configuring Vite's ESM transform just for Sentry.
 *
 * Mapped in jest.config.ts via moduleNameMapper so the stub is picked up
 * automatically across all test suites.
 */

export const initSentry = jest.fn();
export const setUserContext = jest.fn();
export const clearUserContext = jest.fn();
export const captureException = jest.fn();
export const Sentry = {
  init: jest.fn(),
  setUser: jest.fn(),
  withScope: jest.fn((_cb: (scope: any) => void) => {}),
  captureException: jest.fn(),
  browserTracingIntegration: jest.fn(),
  replayIntegration: jest.fn(),
};
