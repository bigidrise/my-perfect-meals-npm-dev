// server/services/creatorSystems/buildChefFingerprint.ts
// Builds a compact chef style fingerprint from published chef_signature_items.
// Stored in creator_system_configs.configJson.styleFingerprint.
// Called on publish/unpublish of any signature item for a given creator.
//
// SAFETY CONTRACT:
//   - Fingerprint is REFERENCE CONTEXT only
//   - It is always injected BELOW medical/dietary hard constraints
//   - It influences style only: flavor, technique, naming, sauce tendency
//   - It NEVER overrides ingredients, macros, allergies, or clinical rules

import { db } from "../../db";
import { creators, creatorSystemConfigs, chefSignatureItems } from "@shared/schema";
import { eq, and } from "drizzle-orm";

export type ChefStyleFingerprint = {
  version: string;
  generatedAt: string;
  sourceItemCount: number;
  topIngredients: string[];
  topTechniques: string[];
  topTags: string[];
  cuisineFocus: string[];
  flavorSignature: string[];
};

function tokenFrequency(tokens: string[]): string[] {
  const counts: Record<string, number> = {};
  for (const t of tokens) {
    const key = t.toLowerCase().trim();
    if (key.length > 1) counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([k]) => k);
}

export async function buildChefFingerprint(creatorId: string): Promise<ChefStyleFingerprint | null> {
  try {
    const items = await db
      .select({
        kind: chefSignatureItems.kind,
        ingredients: chefSignatureItems.ingredients,
        techniques: chefSignatureItems.techniques,
        tags: chefSignatureItems.tags,
        isFeatured: chefSignatureItems.isFeatured,
      })
      .from(chefSignatureItems)
      .where(
        and(
          eq(chefSignatureItems.creatorId, creatorId),
          eq(chefSignatureItems.isPublished, true)
        )
      );

    if (items.length === 0) return null;

    const allIngredients: string[] = [];
    const allTechniques: string[] = [];
    const allTags: string[] = [];

    for (const item of items) {
      // Featured items are weighted 2x by adding them twice
      const weight = item.isFeatured ? 2 : 1;
      const ings = (item.ingredients as string[]) ?? [];
      const techs = (item.techniques as string[]) ?? [];
      const tags = (item.tags as string[]) ?? [];

      // Skip items with fewer than 2 non-empty fields (sparse penalty)
      const nonEmpty = [ings, techs, tags].filter(a => a.length > 0).length;
      if (nonEmpty < 1) continue;

      for (let w = 0; w < weight; w++) {
        allIngredients.push(...ings);
        allTechniques.push(...techs);
        allTags.push(...tags);
      }
    }

    return {
      version: "1.0",
      generatedAt: new Date().toISOString(),
      sourceItemCount: items.length,
      topIngredients: tokenFrequency(allIngredients).slice(0, 10),
      topTechniques: tokenFrequency(allTechniques).slice(0, 8),
      topTags: tokenFrequency(allTags).slice(0, 8),
      // cuisineFocus and flavorSignature are sourced from creator_system_configs
      // and injected separately — this fingerprint only derives from items
      cuisineFocus: [],
      flavorSignature: [],
    };
  } catch (err) {
    console.error("[buildChefFingerprint] Error:", err);
    return null;
  }
}

// Rebuilds and persists the fingerprint for a given creator slug.
// Call this after any publish/unpublish action on a signature item.
export async function rebuildAndStoreFingerprint(creatorSlug: string): Promise<void> {
  try {
    const [row] = await db
      .select({ id: creators.id, configId: creatorSystemConfigs.id, configJson: creatorSystemConfigs.configJson })
      .from(creators)
      .leftJoin(creatorSystemConfigs, eq(creatorSystemConfigs.creatorId, creators.id))
      .where(eq(creators.slug, creatorSlug))
      .limit(1);

    if (!row?.id || !row.configId) {
      console.warn(`[buildChefFingerprint] No config found for slug "${creatorSlug}" — skipping fingerprint rebuild`);
      return;
    }

    const fingerprint = await buildChefFingerprint(row.id);

    const current = (row.configJson as any) ?? {};
    const updatedConfig = {
      ...current,
      styleFingerprint: fingerprint ?? null,
      styleFingerprintUpdatedAt: new Date().toISOString(),
    };

    await db
      .update(creatorSystemConfigs)
      .set({ configJson: updatedConfig, updatedAt: new Date() })
      .where(eq(creatorSystemConfigs.id, row.configId));

    console.log(`[buildChefFingerprint] Rebuilt fingerprint for "${creatorSlug}" — ${fingerprint?.sourceItemCount ?? 0} items`);
  } catch (err) {
    console.error("[buildChefFingerprint] rebuildAndStoreFingerprint error:", err);
  }
}
