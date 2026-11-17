import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { readLanguagePreference, resolveLanguagePreference } from "./languagePreference";

import en from "./locales/en.json";
import es from "./locales/es.json";
import fr from "./locales/fr.json";
import de from "./locales/de.json";
import it from "./locales/it.json";
import pt from "./locales/pt.json";
import zh from "./locales/zh.json";
import ja from "./locales/ja.json";
import ko from "./locales/ko.json";
import ar from "./locales/ar.json";
import hi from "./locales/hi.json";
import ru from "./locales/ru.json";
import vi from "./locales/vi.json";
import tl from "./locales/tl.json";
import xq from "./locales/xq.json";

/** Languages that read right-to-left. */
const RTL_LANGS = new Set(["ar", "he", "fa", "ur"]);

/** Apply dir + lang attributes to <html> whenever the active language changes. */
function applyDocumentDir(lng: string) {
  const base = lng.split("-")[0].toLowerCase();
  const dir = RTL_LANGS.has(base) ? "rtl" : "ltr";
  document.documentElement.dir = dir;
  document.documentElement.lang = base;
}

i18n.use(initReactI18next).init({
  resources: {
    en: { ...en, translation: en },
    es: { ...es, translation: es },
    fr: { ...fr, translation: fr },
    de: { ...de, translation: de },
    it: { ...it, translation: it },
    pt: { ...pt, translation: pt },
    zh: { ...zh, translation: zh },
    ja: { ...ja, translation: ja },
    ko: { ...ko, translation: ko },
    ar: { ...ar, translation: ar },
    hi: { ...hi, translation: hi },
    ru: { ...ru, translation: ru },
    vi: { ...vi, translation: vi },
    tl: { ...tl, translation: tl },
    xq: { ...xq, translation: xq },
  },
  lng: resolveLanguagePreference(readLanguagePreference()),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

// Apply direction immediately for the initial language, then track all changes.
applyDocumentDir(i18n.language);
i18n.on("languageChanged", applyDocumentDir);
window.addEventListener("languagechange", () => {
  if (readLanguagePreference() === "auto") {
    void i18n.changeLanguage(resolveLanguagePreference("auto"));
  }
});

// Expose on window so Playwright and other test tools can call i18n.changeLanguage().
// Both keys are supported: window.i18n (our convention) and window.i18next (used in
// some existing e2e specs that reference the i18next instance by its library name).
if (typeof window !== "undefined") {
  (window as any).i18n = i18n;
  (window as any).i18next = i18n;
}

export default i18n;

export function resolveI18nLang(preferredLanguage: string | null | undefined): string {
  // Preserve the established fallback for unsupported explicit preferences.
  if (preferredLanguage && !["auto", "null"].includes(preferredLanguage) &&
      resolveLanguagePreference(preferredLanguage, "en") === "en") return "en";
  return resolveLanguagePreference(preferredLanguage);
}
