import { db } from "../../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { log } from "../../vite";

export interface PairingsUserProfile {
  userId: string;
  allergies: string[];
  dietaryRestrictions: string[];
  avoidedFoods: string[];
  dislikedFoods: string[];
  healthConditions: string[];
  hasDiabetes: boolean;
  diabetesType: string | null;
  hasGLP1: boolean;
  palateSpiceTolerance: string | null;
  palateSeasoningIntensity: string | null;
  palateFlavorStyle: string | null;
  alcoholContraindications: string[];
}

function extractArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v) => typeof v === "string" && v.trim());
  if (typeof value === "string" && value.trim()) return [value];
  return [];
}

export async function loadPairingsProfile(userId: string): Promise<PairingsUserProfile> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  if (!user) {
    log(`[PairingsProfile] No user found for ${userId}`, "warn");
    return {
      userId,
      allergies: [],
      dietaryRestrictions: [],
      avoidedFoods: [],
      dislikedFoods: [],
      healthConditions: [],
      hasDiabetes: false,
      diabetesType: null,
      hasGLP1: false,
      palateSpiceTolerance: null,
      palateSeasoningIntensity: null,
      palateFlavorStyle: null,
      alcoholContraindications: [],
    };
  }

  const healthConditions = extractArray(user.healthConditions);
  const allergies = extractArray(user.allergies);
  const dietaryRestrictions = extractArray(user.dietaryRestrictions);
  const avoidedFoods = extractArray((user as any).avoidedFoods);
  const dislikedFoods = extractArray((user as any).dislikedFoods);

  const diabetesTypes = ["type1_diabetes", "type2_diabetes", "prediabetes"];
  const hasDiabetes = healthConditions.some((c) => diabetesTypes.includes(c));
  const diabetesType = healthConditions.find((c) => diabetesTypes.includes(c)) || null;
  const hasGLP1 = healthConditions.includes("glp1");

  const alcoholContraindications: string[] = [];
  if (hasDiabetes) {
    alcoholContraindications.push("diabetes: avoid high-sugar cocktails, sweet wines, and sugary mixers");
  }
  if (hasGLP1) {
    alcoholContraindications.push("GLP-1 medication: alcohol may amplify nausea and blood sugar effects");
  }
  const medications = extractArray((user as any).medications);
  if (medications.some((m) => /metformin/i.test(m))) {
    alcoholContraindications.push("metformin: limit alcohol to reduce lactic acidosis risk");
  }

  return {
    userId,
    allergies,
    dietaryRestrictions,
    avoidedFoods,
    dislikedFoods,
    healthConditions,
    hasDiabetes,
    diabetesType,
    hasGLP1,
    palateSpiceTolerance: (user as any).palateSpiceTolerance || null,
    palateSeasoningIntensity: (user as any).palateSeasoningIntensity || null,
    palateFlavorStyle: (user as any).palateFlavorStyle || null,
    alcoholContraindications,
  };
}
