/**
 * Founder-approved Development restoration. These references identify the
 * EXISTING account and Clinic; they never create or mutate either in Neon.
 * This is not a billing entitlement or real-world practitioner identity.
 */
export const DEVELOPMENT_FOUNDER_PHYSICIAN_DEMO = Object.freeze({
  userId: "57887ef3-6d48-4786-9d8c-91a86ae24083",
  clinicId: "2db0fccc-9c3a-4c1d-93f1-533ed59edcb9",
  workspaceId: "3c496f63-2e5c-4527-99e0-941f0ca1d920",
  grantId: "b8a6f8ee-703f-4668-a3e4-8c7804a27582",
  authorization: "founder-approved-development-physician-studio-restoration",
});
export function developmentFounderDemoEnabled(): boolean {
  return process.env.NODE_ENV === "development"
    && !["true", "1"].includes(process.env.REPLIT_DEPLOYMENT ?? "");
}
export function isDevelopmentFounderDemoAccount(userId: string): boolean {
  return developmentFounderDemoEnabled() && userId === DEVELOPMENT_FOUNDER_PHYSICIAN_DEMO.userId;
}
