import { sql } from "drizzle-orm";

export async function runOrganizationOwnerAttachmentMigration(database: {
  execute: (query: any) => Promise<any>;
}): Promise<void> {
  await database.execute(sql`
    ALTER TABLE businesses
    ADD COLUMN IF NOT EXISTS owner_workspace_disconnected_at timestamptz
  `);
}