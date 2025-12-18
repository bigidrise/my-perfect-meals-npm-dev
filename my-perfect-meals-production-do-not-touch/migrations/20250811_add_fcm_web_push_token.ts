import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { Client } from 'pg';

export async function up(client: Client) {
  const db = drizzle(client);
  await db.execute(sql`DO $$ BEGIN
    BEGIN
      ALTER TABLE users ADD COLUMN fcm_web_push_token text;
    EXCEPTION
      WHEN duplicate_column THEN RAISE NOTICE 'Column fcm_web_push_token already exists, skipping';
    END; END $$;`);
}

export async function down(client: Client) {
  const db = drizzle(client);
  await db.execute(sql`ALTER TABLE users DROP COLUMN IF EXISTS fcm_web_push_token;`);
}