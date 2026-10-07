// Keep the Vite-only gate separate so authentication initialization can be
// exercised by the CommonJS test runner without changing route authorization.
export const IS_DEVELOPMENT = import.meta.env.DEV;
export const DEVELOPMENT_AUTH_PUBLIC_PATHS = IS_DEVELOPMENT
  ? ["/__modal-test__", "/__sheet-test__", "/rewardful/connect/confirm"]
  : [];
