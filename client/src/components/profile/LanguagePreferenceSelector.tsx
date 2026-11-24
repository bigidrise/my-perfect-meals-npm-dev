import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/apiRequest";
import i18n, { resolveI18nLang } from "@/i18n";
import {
  readLanguagePreference,
  storeLanguagePreference,
  resolveLanguagePreference,
} from "@/i18n/languagePreference";

type LanguageChoice = "auto" | "en" | "es";

export function LanguagePreferenceSelector() {
  const { t } = useTranslation();
  const { user, setUser, loading } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [localPreference, setLocalPreference] = useState(readLanguagePreference);
  const currentUser = useRef(user);
  currentUser.current = user;
  const pending = useRef(false);

  const preference = user?.preferredLanguage ?? localPreference;
  const selected = preference === "auto"
    ? "auto"
    : resolveLanguagePreference(preference);

  const handleSelect = async (code: LanguageChoice) => {
    if (loading || pending.current || code === selected) return;

    const ownerId = user?.id;
    const previousPreference = preference;
    const previousLanguage = i18n.language;

    pending.current = true;
    setSaving(true);

    try {
      if (ownerId) {
        await apiRequest("/api/user/preferences", {
          method: "PATCH",
          body: JSON.stringify({ preferredLanguage: code }),
        });
      }

      if (currentUser.current?.id !== ownerId) return;

      storeLanguagePreference(code);
      setLocalPreference(code);

      if (currentUser.current) {
        setUser({ ...currentUser.current, preferredLanguage: code });
      }

      await i18n.changeLanguage(resolveI18nLang(code));
    } catch {
      if (currentUser.current?.id !== ownerId) return;

      storeLanguagePreference(previousPreference);
      setLocalPreference(previousPreference);
      await i18n.changeLanguage(previousLanguage);

      toast({
        title: i18n.t("language.errorSave"),
        description: i18n.t("language.errorSaveDesc"),
        variant: "destructive",
      });
    } finally {
      pending.current = false;
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto space-y-2">
      <label
        htmlFor="entry-language-preference"
        className="block text-sm font-medium text-white/80"
      >
        {t("language.pageTitle")}
      </label>
      <select
        id="entry-language-preference"
        value={selected}
        disabled={saving || loading}
        onChange={(event) => {
          const code = event.target.value;
          if (code === "auto" || code === "en" || code === "es") {
            void handleSelect(code);
          }
        }}
        className="w-full rounded-lg border border-white/20 bg-black text-white px-3 py-2 disabled:opacity-60"
      >
        <option value="auto">{t("language.auto")}</option>
        <option value="en">English</option>
        <option value="es">Español</option>
      </select>
    </div>
  );
}
