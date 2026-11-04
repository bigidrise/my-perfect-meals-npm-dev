/**
 * Development file-serving policy, not Feature Intelligence runtime integration.
 * Keep Vite's existing secret/certificate/Git exclusions when adding private
 * engineering artifacts. Shared by both Vite configurations and middleware mode.
 */
export const PRIVATE_DEVELOPMENT_FILE_PATTERNS = [
  ".env", ".env.*", "*.{crt,pem}", "**/.git/**",
  "**/generated-artifacts/**",
  "**/scripts/feature-intelligence/**",
  "**/server/services/coaching/featureIntelligence*.ts",
];
