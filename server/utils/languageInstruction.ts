/**
 * Language instruction utility for AI prompt injection.
 *
 * Phase 1 — International Architecture:
 *   - AI generates directly in the user's preferred language
 *   - No Translate-button needed for normal use
 *   - The Translate button is repurposed for cross-user communication
 */

const LANGUAGE_NAMES: Record<string, string> = {
  es: "Spanish",
  fr: "French",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
  zh: "Chinese (Simplified)",
  ja: "Japanese",
  ko: "Korean",
  ar: "Arabic",
  hi: "Hindi",
  ru: "Russian",
  vi: "Vietnamese",
  tl: "Filipino (Tagalog)",
};

/**
 * Given a preferredLanguage value (BCP-47 tag or "auto"), return the
 * language instruction string to append to any AI system prompt.
 *
 * Returns an empty string for English or unknown/auto — no instruction
 * is needed when the default language (English) is correct.
 *
 * @param lang - "auto", null, undefined, "en", "es", "fr-FR", etc.
 */
export function getLanguageInstruction(lang: string | null | undefined): string {
  if (!lang || lang === "auto" || lang === "null") return "";

  // Normalize BCP-47: "zh-CN" → "zh", "es-419" → "es", "fr-FR" → "fr"
  const base = lang.split("-")[0].toLowerCase();
  if (base === "en") return "";

  const name = LANGUAGE_NAMES[base];
  if (!name) return "";

  return (
    `\n\n🌐 LANGUAGE REQUIREMENT — MANDATORY: Generate ALL content entirely in ${name}. ` +
    `This includes meal names, descriptions, ingredient names, cooking instructions, ` +
    `nutritional explanations, recommendations, and every other word in your response. ` +
    `Do NOT use English. Every word must be in ${name}.`
  );
}

/**
 * Supported language codes (for validation in the PATCH endpoint).
 * "auto" means "use device language" — resolved client-side via navigator.language.
 */
export const SUPPORTED_LANGUAGES = [
  "auto",
  "en",
  "es",
  "fr",
  "de",
  "it",
  "pt",
  "zh",
  "ja",
  "ko",
  "ar",
  "hi",
  "ru",
  "vi",
  "tl",
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
