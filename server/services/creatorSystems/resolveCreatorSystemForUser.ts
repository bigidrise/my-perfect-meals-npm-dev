// server/services/creatorSystems/resolveCreatorSystemForUser.ts
// DB helper: resolves the active CreatorSystem for a given userId.
//
// LOOKUP ORDER:
//   1. users.active_system → slug
//   2. If slug is "default" or null → return registry default
//   3. Look up DB: creators (by slug) → creator_system_configs
//   4. If found + published → build CreatorSystemConfig from DB config_json
//   5. Fall back to registry (for hardcoded systems like test_system)
//   6. Final fallback: creatorSystems.default
//
// Never throws. Always returns a valid config.

import { db } from "../../db";
import { users, creators, creatorSystemConfigs } from "@shared/schema";
import { eq } from "drizzle-orm";
import { creatorSystems, type CreatorSystemConfig } from "./registry";

export async function resolveCreatorSystemForUser(userId: string): Promise<CreatorSystemConfig> {
  try {
    const [userRow] = await db
      .select({ activeSystem: users.activeSystem })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const slug = userRow?.activeSystem;
    if (!slug || slug === "default") return creatorSystems.default;

    // 1. Try DB-backed creator config (self-serve creators)
    const [dbRow] = await db
      .select({ configJson: creatorSystemConfigs.configJson, slug: creators.slug, isActive: creators.isActive })
      .from(creatorSystemConfigs)
      .innerJoin(creators, eq(creatorSystemConfigs.creatorId, creators.id))
      .where(eq(creators.slug, slug))
      .limit(1);

    if (dbRow && dbRow.isActive && dbRow.configJson) {
      const config = dbRow.configJson as CreatorSystemConfig;
      // Ensure id matches the slug (defensive)
      return { ...config, id: slug };
    }

    // 2. Fall back to registry (for hardcoded dev/test systems)
    if (creatorSystems[slug]) return creatorSystems[slug];

    // 3. Final safety fallback
    console.warn(`[CreatorSystem] No config found for slug "${slug}" — using default`);
    return creatorSystems.default;

  } catch (err) {
    console.error("[CreatorSystem] resolveCreatorSystemForUser error:", err);
    return creatorSystems.default;
  }
}
