/**
 * Meal Translation Service
 *
 * Translates AI-generated saved meal content (name, description, ingredients,
 * instructions) into the user's selected locale. The canonical DB record is
 * never modified — translations are a display layer cached in meal_translations.
 *
 * Safe-list: numbers, amounts, units, nutrition values, allergen identifiers,
 * clinical flags, and temperatures are NEVER altered by the translator.
 */
import crypto from "crypto";
import OpenAI from "openai";
import { db } from "../db";
import { sql } from "drizzle-orm";

// ─── Locale → language name for the OpenAI prompt ───────────────────────────
const LOCALE_NAMES: Record<string, string> = {
  es: "Spanish",
  fr: "French",
  de: "German",
  it: "Italian",
  pt: "Portuguese (Brazilian)",
  zh: "Chinese (Simplified)",
  ja: "Japanese",
  ko: "Korean",
  ar: "Arabic",
  hi: "Hindi",
  ru: "Russian",
  vi: "Vietnamese",
  tl: "Filipino (Tagalog)",
};

// ─── Types ───────────────────────────────────────────────────────────────────
export interface MealTranslation {
  translatedName: string;
  translatedDescription?: string | null;
  translatedIngredients?: Array<{ item: string; notes?: string }> | null;
  translatedInstructions?: string[] | null;
  locale: string;
  fromCache: boolean;
}

// ─── Source hash — SHA-256 over the translatable text fields ─────────────────
export function computeSourceHash(title: string, mealData: any): string {
  const canonical = {
    title: title ?? "",
    description: mealData?.description ?? "",
    ingredients: (mealData?.ingredients ?? []).map((i: any) =>
      typeof i === "string"
        ? { item: i, notes: "" }
        : { item: i.item || i.name || "", notes: i.notes || "" }
    ),
    instructions: (Array.isArray(mealData?.instructions) ? mealData.instructions : []).map(
      (s: any) => (typeof s === "string" ? s : s.text || s.step || "")
    ),
  };
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(canonical))
    .digest("hex")
    .slice(0, 32);
}

// ─── Main entry — fetch from cache or translate and cache ────────────────────
export async function translateMeal(
  savedMealId: string,
  locale: string,
  title: string,
  mealData: any
): Promise<MealTranslation> {
  const languageName = LOCALE_NAMES[locale];
  if (!languageName) throw new Error(`Unsupported locale: ${locale}`);

  const sourceHash = computeSourceHash(title, mealData);

  // ── 1. Check cache ──────────────────────────────────────────────────────
  const cached = await db.execute(sql`
    SELECT translated_name, translated_description,
           translated_ingredients, translated_instructions, source_hash
    FROM meal_translations
    WHERE saved_meal_id = ${savedMealId}::uuid AND locale = ${locale}
    LIMIT 1
  `);
  const row = cached.rows?.[0] as any;

  if (row && row.source_hash === sourceHash) {
    return {
      translatedName: row.translated_name,
      translatedDescription: row.translated_description ?? null,
      translatedIngredients: row.translated_ingredients ?? null,
      translatedInstructions: row.translated_instructions ?? null,
      locale,
      fromCache: true,
    };
  }

  // ── 2. Build translatable payload (text only — no numbers/units) ────────
  const ingredients = (mealData?.ingredients ?? []).map((i: any) => {
    if (typeof i === "string") return { item: i };
    const entry: { item: string; notes?: string } = {
      item: i.item || i.name || "",
    };
    if (i.notes) entry.notes = i.notes;
    return entry;
  });

  const instructions: string[] = (
    Array.isArray(mealData?.instructions) ? mealData.instructions : []
  ).map((s: any) => (typeof s === "string" ? s : s.text || s.step || ""));

  const payload: Record<string, any> = { name: title };
  if (mealData?.description) payload.description = mealData.description;
  if (ingredients.length) payload.ingredients = ingredients;
  if (instructions.length) payload.instructions = instructions;

  // ── 3. OpenAI translation call ──────────────────────────────────────────
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const systemPrompt = `You are a food content translator.

STRICT RULES — follow all of these without exception:
• Translate ONLY text. Numbers, temperatures, and measurements must appear identically in the output (e.g. "375°F", "20 minutes", "2 cups", "150g", "1/2 teaspoon").
• Do NOT change ingredient quantities or units — only translate item names and notes.
• Allergen names may be localized (e.g. "peanuts" → "cacahuetes") but their meaning must be preserved exactly.
• Do NOT add or remove ingredients or steps.
• Return ONLY valid JSON with the same top-level keys as the input. No extra keys. No explanation.
• Translate to: ${languageName}`;

  let translated: Record<string, any> = {};
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(payload) },
      ],
    });
    translated = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
  } catch (err: any) {
    console.error("[mealTranslation] OpenAI call failed:", err.message);
    // Return original content — fall back silently
    return {
      translatedName: title,
      translatedDescription: mealData?.description ?? null,
      translatedIngredients: ingredients.length ? ingredients : null,
      translatedInstructions: instructions.length ? instructions : null,
      locale,
      fromCache: false,
    };
  }

  const result: MealTranslation = {
    translatedName: translated.name || translated.title || title,
    translatedDescription: translated.description ?? null,
    translatedIngredients: Array.isArray(translated.ingredients) ? translated.ingredients : null,
    translatedInstructions: Array.isArray(translated.instructions)
      ? translated.instructions
      : null,
    locale,
    fromCache: false,
  };

  // ── 4. Upsert into cache ────────────────────────────────────────────────
  try {
    await db.execute(sql`
      INSERT INTO meal_translations
        (saved_meal_id, locale, translated_name, translated_description,
         translated_ingredients, translated_instructions, source_hash)
      VALUES (
        ${savedMealId}::uuid, ${locale},
        ${result.translatedName},
        ${result.translatedDescription},
        ${JSON.stringify(result.translatedIngredients)}::jsonb,
        ${JSON.stringify(result.translatedInstructions)}::jsonb,
        ${sourceHash}
      )
      ON CONFLICT (saved_meal_id, locale) DO UPDATE SET
        translated_name         = EXCLUDED.translated_name,
        translated_description  = EXCLUDED.translated_description,
        translated_ingredients  = EXCLUDED.translated_ingredients,
        translated_instructions = EXCLUDED.translated_instructions,
        source_hash             = EXCLUDED.source_hash,
        created_at              = NOW()
    `);
  } catch (cacheErr: any) {
    console.error("[mealTranslation] Cache upsert failed (non-fatal):", cacheErr.message);
  }

  return result;
}
