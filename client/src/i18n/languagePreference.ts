/** A non-sensitive UI hint, never an authentication or account authority. */
export const LANGUAGE_PREFERENCE_KEY = "mpm.ui.languagePreference";
export const SUPPORTED_UI_LANGUAGES = [
  "en", "es", "fr", "de", "it", "pt", "zh", "ja", "ko", "ar", "hi", "ru", "vi", "tl",
] as const;
/** Release availability only. Keep the full definitions/resources for later activation. */
export const CUSTOMER_UI_LANGUAGES = ["en", "es"] as const;
export function isCustomerLanguage(value: string): value is typeof CUSTOMER_UI_LANGUAGES[number] {
  return (CUSTOMER_UI_LANGUAGES as readonly string[]).includes(value);
}

export function normalizeLanguagePreference(value: string | null | undefined): string {
  if (!value || value === "auto" || value === "null") return "auto";
  const base = value.split("-")[0].toLowerCase();
  return (SUPPORTED_UI_LANGUAGES as readonly string[]).includes(base) ? base : "en";
}

export function readLanguagePreference(): string {
  try {
    return normalizeLanguagePreference(localStorage.getItem(LANGUAGE_PREFERENCE_KEY));
  } catch {
    return "auto";
  }
}

export function storeLanguagePreference(value: string | null | undefined): void {
  try {
    // Store the user's choice, NOT the resolved device language.
    localStorage.setItem(LANGUAGE_PREFERENCE_KEY, normalizeLanguagePreference(value));
  } catch {
    // Storage may be disabled. The authenticated preference still owns this session.
  }
}

export function resolveLanguagePreference(
  preference: string | null | undefined,
  deviceLanguage = typeof navigator === "undefined" ? "en" : navigator.language,
): string {
  const normalized = normalizeLanguagePreference(preference);
  if (normalized !== "auto") return isCustomerLanguage(normalized) ? normalized : "en";
  const base = (deviceLanguage || "en").split("-")[0].toLowerCase();
  return isCustomerLanguage(base) ? base : "en";
}
