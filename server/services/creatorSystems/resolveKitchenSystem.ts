// server/services/creatorSystems/resolveKitchenSystem.ts
// Resolves a CreatorSystemConfig from a kitchen slug stored in the DB.
// This is the Phase 2 bridge that lets kitchen-scoped generation bypass
// resolveActiveSystem(user) and inject the chef overlay instead.

import { db } from "../../db";
import { creators, creatorSystemConfigs } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { CreatorSystemConfig } from "./registry";
import { creatorSystems } from "./registry";

export async function resolveKitchenSystem(slug: string): Promise<CreatorSystemConfig | null> {
  try {
    const [row] = await db
      .select({
        slug: creators.slug,
        displayName: creators.displayName,
        isActive: creators.isActive,
        configJson: creatorSystemConfigs.configJson,
      })
      .from(creators)
      .leftJoin(creatorSystemConfigs, eq(creatorSystemConfigs.creatorId, creators.id))
      .where(eq(creators.slug, slug))
      .limit(1);

    if (!row || !row.configJson) return null;

    const cfg = row.configJson as any;

    const system: CreatorSystemConfig = {
      id: row.slug,
      name: row.displayName,
      type: "chef",
      supports: cfg.supports ?? { meals: true, desserts: true, beverages: true },
      style: {
        techniques: cfg.style?.techniques ?? [],
        flavorProfiles: cfg.style?.flavorProfiles ?? [],
        ingredientBias: cfg.style?.ingredientBias ?? [],
        naming: cfg.style?.naming ?? { pattern: "technique-first", includeSauce: false },
        instructionRules: cfg.style?.instructionRules ?? {
          requireHighHeatProtein: false,
          requireSauceBuild: false,
          requireLayering: false,
        },
        description: cfg.style?.description ?? { tone: "chef", forbidWords: [] },
      },
      // personaPrompt — admin-written chef voice amplifier
      ...(cfg.personaPrompt ? { personaPrompt: cfg.personaPrompt } : {}),
      // styleFingerprint — dynamic summary derived from published signature items (Phase 2A)
      ...(cfg.styleFingerprint ? { styleFingerprint: cfg.styleFingerprint } : {}),
      // cuisine/flavor context from config (passed to fingerprint for enrichment)
      ...(cfg.cuisineTypes ? { cuisineTypes: cfg.cuisineTypes } : {}),
    } as CreatorSystemConfig & { personaPrompt?: string; styleFingerprint?: any; cuisineTypes?: string[] };

    return system;
  } catch (err) {
    console.error("[resolveKitchenSystem] DB error:", err);
    return null;
  }
}
