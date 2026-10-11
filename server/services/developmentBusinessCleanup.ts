import { sql } from "drizzle-orm";
import type { db } from "../db";

/** Called only by the existing authenticated Development-only reset route.
 * FKs detach the personal pilot and anonymize the retained consent receipt.
 * Any remaining legacy FK failure rolls the entire cleanup back.
 */
export async function deleteDevelopmentBusinessRecords(
  database: Pick<typeof db, "transaction">, businessId: string,
) {
  await database.transaction(async tx => {
    await tx.execute(sql`DELETE FROM business_invitations WHERE business_id = ${businessId}`);
    await tx.execute(sql`DELETE FROM business_members WHERE business_id = ${businessId}`);
    await tx.execute(sql`DELETE FROM businesses WHERE id = ${businessId}`);
  });
}
