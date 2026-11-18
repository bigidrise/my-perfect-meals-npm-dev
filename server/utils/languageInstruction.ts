/**
 * Language instruction utility for AI prompt injection.
 *
 * Phase 1 — International Architecture:
 *   - AI generates directly in the user's preferred language
 *   - No Translate-button needed for normal use
 *   - The Translate button is repurposed for cross-user communication
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { isCustomerLanguage, resolveLanguagePreference } from "../../client/src/i18n/languagePreference";

const requestLanguage = new AsyncLocalStorage<string | undefined>();

/** Request-scoped presentation locale; never mutate authUser or saved preferences. */
export function requestLanguageContext(
  req: { headers: Record<string, string | string[] | undefined> },
  _res: unknown,
  next: () => void,
): void {
  const header = req.headers["x-mpm-ui-language"];
  const base = typeof header === "string" && /^[a-z]{2}(?:-[a-z0-9]{2,8})?$/i.test(header)
    ? header.split("-")[0].toLowerCase() : undefined;
  const language = base && isCustomerLanguage(base)
    ? base : undefined;
  requestLanguage.run(language, next);
}

/** Resolves presentation only; callers must never save this as the user's choice. */
export function resolveRequestLanguagePreference(preference: string | null | undefined): string {
  return resolveLanguagePreference(preference, requestLanguage.getStore() ?? "en");
}

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
 * Auto uses a validated, request-scoped resolved UI language when available.
 * English or unknown languages still return no instruction. The saved account
 * preference is never overwritten, and background calls default to English.
 *
 * @param lang - "auto", null, undefined, "en", "es", "fr-FR", etc.
 */
export function getLanguageInstruction(lang: string | null | undefined): string {
  // A saved explicit preference wins. Auto obtains only this request's resolved
  // UI/device language, with the same English fallback outside HTTP requests.
  lang = resolveRequestLanguagePreference(lang);

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
