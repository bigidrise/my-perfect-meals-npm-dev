// server/config/flags.ts
// Central feature flags with env defaults; import these everywhere.
export const flags = {
  MEALGEN_V2: process.env.MEALGEN_V2 === "true",
  IMAGE_DEFER_DEFAULT: process.env.IMAGE_DEFER_DEFAULT !== "false", // default true
  VARIETY_BACKEND: process.env.VARIETY_BACKEND || "memory", // "redis"|"memory"
  STRICT_FAIL_CLOSED: process.env.STRICT_FAIL_CLOSED !== "false", // default true
  RATE_LIMIT: process.env.RATE_LIMIT !== "false", // default true
  QA_DASHBOARD: process.env.QA_DASHBOARD === "true", // gated in prod
};