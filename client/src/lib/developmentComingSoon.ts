/** Presentation only. Never enables the advisor or changes subscription access. */
export const developmentComingSoonEnabled =
  import.meta.env.DEV && !import.meta.env.PROD;
