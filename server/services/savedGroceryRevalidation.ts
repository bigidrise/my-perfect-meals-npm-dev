import { eq } from "drizzle-orm";
import { db } from "../db";
import { users, type UserSavedGroceryItem } from "@shared/schema";
import { loadUserProtocolEnvelope } from "./protocolEnvelope";
import { resolveGLP1GlobalContext } from "./glp1/resolveGLP1GlobalContext";
import {
  filterSavedGroceriesForCompliance,
  type SavedGroceryItemSlim,
} from "./savedGroceryCompliance";

export interface SavedGroceryComplianceDecision {
  id: string;
  status: "approved" | "blocked";
  reason: string | null;
}

function blockedDecisions(
  items: UserSavedGroceryItem[],
  reason: string,
): SavedGroceryComplianceDecision[] {
  return items.map((item) => ({
    id: item.id,
    status: "blocked",
    reason,
  }));
}

/**
 * Re-evaluates saved products against the user's current authoritative profile.
 * Products stay saved when blocked; callers decide whether to display or insert.
 * Resolver failures fail closed instead of silently approving stale favorites.
 */
export async function revalidateSavedGroceriesForUser(
  userId: string,
  items: UserSavedGroceryItem[],
): Promise<SavedGroceryComplianceDecision[]> {
  if (items.length === 0) return [];

  let envelope;
  try {
    envelope = await loadUserProtocolEnvelope(userId);
    if (!envelope) {
      return blockedDecisions(
        items,
        "Current dietary and medical profile could not be verified. Try again before adding this product.",
      );
    }
  } catch (error: any) {
    console.error("[SavedGroceries] Protocol envelope revalidation failed:", error?.message);
    return blockedDecisions(
      items,
      "Current dietary and medical profile could not be verified. Try again before adding this product.",
    );
  }

  let rawGlp1;
  try {
    const todayISO = new Date().toISOString().slice(0, 10);
    rawGlp1 = await resolveGLP1GlobalContext(userId, todayISO);
  } catch (error: any) {
    console.error("[SavedGroceries] GLP-1 revalidation failed:", error?.message);
    return blockedDecisions(
      items,
      "Current GLP-1 status could not be verified. Try again before adding this product.",
    );
  }

  let dailyCarbsTarget: number | null = null;
  if (envelope.hasDiabetes) {
    try {
      const [userRow] = await db
        .select({ dailyCarbsTarget: users.dailyCarbsTarget })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      dailyCarbsTarget = userRow?.dailyCarbsTarget ?? null;
    } catch (error: any) {
      console.error("[SavedGroceries] Diabetes target revalidation failed:", error?.message);
      return blockedDecisions(
        items,
        "Current diabetes targets could not be verified. Try again before adding this product.",
      );
    }
  }

  const slimItems: SavedGroceryItemSlim[] = items.map((item) => {
    const productMeta = item.productMeta as Record<string, unknown> | null;
    const ingredients = Array.isArray(productMeta?.ingredients)
      ? productMeta.ingredients.filter((value): value is string => typeof value === "string")
      : null;
    const certifications = Array.isArray(productMeta?.certifications)
      ? productMeta.certifications.filter((value): value is string => typeof value === "string")
      : Array.isArray(productMeta?.labels)
        ? productMeta.labels.filter((value): value is string => typeof value === "string")
        : null;
    return {
      id: item.id,
      productName: item.productName,
      brand: item.brand,
      category: item.category,
      productKey: item.productKey,
      nutritionJson: item.nutritionJson,
      ingredients,
      certifications,
      savedAt: item.savedAt,
    };
  });

  const glp1Targets = rawGlp1?.isActive && rawGlp1.resolvedTargets
    ? rawGlp1.resolvedTargets
    : null;
  const diabeticCarbCeiling = envelope.hasDiabetes
    ? (dailyCarbsTarget && dailyCarbsTarget > 0
        ? Math.round(dailyCarbsTarget / 3)
        : 45)
    : null;
  const { excluded } = filterSavedGroceriesForCompliance(
    slimItems,
    envelope,
    {
      glp1Targets,
      isDiabetic: envelope.hasDiabetes,
      diabeticCarbCeiling,
    },
  );
  const exclusionById = new Map(
    excluded.map((item) => [item.id, item.exclusionReason]),
  );

  return items.map((item) => ({
    id: item.id,
    status: exclusionById.has(item.id) ? "blocked" : "approved",
    reason: exclusionById.get(item.id) ?? null,
  }));
}