import i18n from "i18next";
import { initReactI18next } from "react-i18next";

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

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    es: { translation: es },
    fr: { translation: fr },
    de: { translation: de },
    it: { translation: it },
    pt: { translation: pt },
    zh: { translation: zh },
    ja: { translation: ja },
    ko: { translation: ko },
    ar: { translation: ar },
    hi: { translation: hi },
    ru: { translation: ru },
    vi: { translation: vi },
    tl: { translation: tl },
  },
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18n;

export function resolveI18nLang(preferredLanguage: string | null | undefined): string {
  if (!preferredLanguage || preferredLanguage === "auto" || preferredLanguage === "null") {
    const device = navigator.language?.split("-")[0]?.toLowerCase() ?? "en";
    const supported = ["en","es","fr","de","it","pt","zh","ja","ko","ar","hi","ru","vi","tl"];
    return supported.includes(device) ? device : "en";
  }
  const base = preferredLanguage.split("-")[0].toLowerCase();
  const supported = ["en","es","fr","de","it","pt","zh","ja","ko","ar","hi","ru","vi","tl"];
  return supported.includes(base) ? base : "en";
}
