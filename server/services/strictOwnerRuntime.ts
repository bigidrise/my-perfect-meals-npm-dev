/** Separate runtime seam so offline tests need not modify process environment. */
export function strictOwnerDevelopmentEnabled(): boolean {
  return process.env.NODE_ENV === "development" && !process.env.REPLIT_DEPLOYMENT;
}
