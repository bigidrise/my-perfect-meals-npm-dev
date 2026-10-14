import { and, eq } from "drizzle-orm";
import { users } from "@shared/schema";
import { clientLinks } from "../db/schema/procare";
import type { StarchPreferences } from "@shared/starchPreferences";
import { StudioStarchAccessError } from "../routes/studioStarchPreferences";
import type { db } from "../db";

/** No connection is opened here. Tests pass an isolated transaction adapter. */
export async function writeStudioStarchPreferences(
  database: Pick<typeof db, "transaction">, actorId: string,
  clientId: string, preferences: StarchPreferences,
) {
  await database.transaction(async tx => {
    const [link] = await tx.select({ id: clientLinks.id }).from(clientLinks)
      .where(and(eq(clientLinks.proUserId, actorId), eq(clientLinks.clientUserId, clientId), eq(clientLinks.active, true)))
      .limit(1).for("update");
    if (!link) throw new StudioStarchAccessError(403, "No active client relationship");
    const updated = await tx.update(users).set({
      defaultStarchMealsPerDay: preferences.defaultStarchMealsPerDay,
      starchDistributionStrategy: preferences.starchDistributionStrategy,
      starchPlanDefined: true,
    }).where(eq(users.id, clientId)).returning({ id: users.id });
    if (!updated.length) throw new StudioStarchAccessError(404, "Client not found");
  });
}
