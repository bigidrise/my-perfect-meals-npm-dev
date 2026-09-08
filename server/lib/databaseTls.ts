export interface VerifiedDatabaseTlsConfig {
  rejectUnauthorized: true;
}

const VERIFIED_TLS: VerifiedDatabaseTlsConfig = Object.freeze({
  rejectUnauthorized: true,
});

export function getDatabaseTlsConfig(
  connectionString: string | undefined,
  options: { requireTls?: boolean } = {},
): VerifiedDatabaseTlsConfig | undefined {
  if (!connectionString) return undefined;

  let parsed: URL;
  try {
    parsed = new URL(connectionString);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL connection URL");
  }

  const hostname = parsed.hostname.toLowerCase();
  const isNeon = hostname === "neon.tech" || hostname.endsWith(".neon.tech");
  const sslMode = parsed.searchParams.get("sslmode")?.toLowerCase();
  const requestsTls = ["prefer", "require", "verify-ca", "verify-full"].includes(
    sslMode ?? "",
  );

  return isNeon || requestsTls || options.requireTls ? VERIFIED_TLS : undefined;
}