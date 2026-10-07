import { eq, sql } from "drizzle-orm";
import { users } from "@shared/schema";
import { db } from "../db";

/** Fail closed until the bounded erasure migration has been installed. */
export async function eraseAccount(userId: string, database = db): Promise<void> {
  await database.transaction(async tx => {
    const result = await tx.execute(sql`
      SELECT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgrelid='public.users'::regclass
          AND tgname='users_professional_lifecycle_erasure'
          AND tgenabled='O' AND NOT tgisinternal
      ) AS ready
    `);
    if (result.rows[0]?.ready !== true) throw new Error("Professional account erasure schema is not ready");
    // The BEFORE DELETE trigger redacts/deletes lifecycle data in this same
    // transaction. Any FK, trigger or account deletion failure rolls it all back.
    await tx.delete(users).where(eq(users.id, userId));
  });
}
