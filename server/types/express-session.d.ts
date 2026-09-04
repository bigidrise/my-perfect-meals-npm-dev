import "express-session";

declare module "express-session" {
  interface SessionData {
    userId?: string;
    user?: {
      name?: string;
      email?: string;
    };
    /** Set during MFA challenge — userId of user who has passed password auth but not yet TOTP */
    pendingMfaUserId?: string;
    /** True once user has completed MFA challenge in this session */
    mfaVerified?: boolean;
    /** Temporary TOTP secret during MFA setup (before user confirms first code) */
    pendingMfaSecret?: string;
    /** Per-session synchronizer token required for cookie-authenticated mutations */
    csrfToken?: string;
  }
}
