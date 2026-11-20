import { Client } from "pg";
import { getDatabaseTlsConfig } from "../server/lib/databaseTls";
import { auditProfessionalLegalAcceptance } from "../server/services/professionalLegalAudit";

function argument(name: string): string | null {
  return process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3).trim() || null;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("Application DATABASE_URL is required.");
  const client = new Client({
    connectionString: databaseUrl, ssl: getDatabaseTlsConfig(databaseUrl),
    connectionTimeoutMillis: 5000, statement_timeout: 15000,
  });
  try {
    await client.connect();
    const report = await auditProfessionalLegalAcceptance(client, {
      email: argument("email")?.toLowerCase(),
      accountName: argument("account-name"),
      studioName: argument("studio-name"),
    });
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await client.end();
  }
}

void main().catch((error: unknown) => {
  const code = error && typeof error === "object" && "code" in error ? error.code : "AUDIT_FAILED";
  console.error("Professional legal audit stopped without modifying data.", { code });
  process.exitCode = 1;
});
