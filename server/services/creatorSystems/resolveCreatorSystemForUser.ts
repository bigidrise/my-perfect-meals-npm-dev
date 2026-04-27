// server/services/creatorSystems/resolveCreatorSystemForUser.ts
// DB helper: resolves the active CreatorSystem for a given userId.
// Any route can call this with just a userId string — no need to fetch the full user first.
// Always returns a valid system. Never throws.

import { db } from "../../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { creatorSystems, type CreatorSystemConfig } from "./registry";

export async function resolveCreatorSystemForUser(userId: string): Promise<CreatorSystemConfig> {
  try {
    const [row] = await db
      .select({ activeSystem: users.activeSystem })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const key = row?.activeSystem;
    if (!key || key === "default") return creatorSystems.default;
    return creatorSystems[key] ?? creatorSystems.default;
  } catch {
    return creatorSystems.default;
  }
}
