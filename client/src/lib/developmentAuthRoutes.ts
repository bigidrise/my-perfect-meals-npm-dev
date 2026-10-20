// Keep the Vite-only gate separate so authentication initialization can be
// exercised by the CommonJS test runner without changing route authorization.
import { COMING_SOON_ADVISOR_PATH } from "./comingSoonRoutes";
export const IS_DEVELOPMENT = import.meta.env.DEV;
// Retain the AuthContext import contract. Only the informational page is public
// in every build; all existing Development-only exceptions remain Development-only.
export const DEVELOPMENT_AUTH_PUBLIC_PATHS = [
  COMING_SOON_ADVISOR_PATH,
  ...(IS_DEVELOPMENT
    ? ["/__modal-test__", "/__sheet-test__", "/rewardful/connect/confirm", "/activate/business-pilot"]
    : []),
];
