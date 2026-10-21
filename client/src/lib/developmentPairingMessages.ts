// Browser-only gate: the Phase 1 message correction is not a Production change.
export const developmentPairingMessagesEnabled =
  import.meta.env.DEV && !import.meta.env.PROD;
