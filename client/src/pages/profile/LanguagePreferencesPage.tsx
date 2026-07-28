import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/apiRequest";
import { Globe, ChevronLeft, Loader2, Check } from "lucide-react";

const LANGUAGES = [
  {
    code: "auto",
    label: "Auto (Device)",
    native: "Automatic",
    description: "My Perfect Meals detects your device language and generates content in it automatically — recommended for most users.",
  },
  { code: "en", label: "English", native: "English", description: "All AI-generated content in English." },
  { code: "es", label: "Spanish", native: "Español", description: "Todo el contenido generado por IA en español." },
  { code: "fr", label: "French", native: "Français", description: "Tout le contenu généré par l'IA en français." },
  { code: "de", label: "German", native: "Deutsch", description: "Alle KI-generierten Inhalte auf Deutsch." },
  { code: "it", label: "Italian", native: "Italiano", description: "Tutti i contenuti generati dall'IA in italiano." },
  { code: "pt", label: "Portuguese", native: "Português", description: "Todo o conteúdo gerado por IA em português." },
  { code: "zh", label: "Chinese", native: "中文", description: "所有AI生成的内容均以中文（简体）呈现。" },
  { code: "ja", label: "Japanese", native: "日本語", description: "すべてのAI生成コンテンツが日本語で表示されます。" },
  { code: "ko", label: "Korean", native: "한국어", description: "모든 AI 생성 콘텐츠가 한국어로 제공됩니다." },
  { code: "ar", label: "Arabic", native: "العربية", description: "جميع المحتوى الذي ينتجه الذكاء الاصطناعي باللغة العربية." },
  { code: "hi", label: "Hindi", native: "हिन्दी", description: "सभी AI-जनित सामग्री हिंदी में।" },
  { code: "ru", label: "Russian", native: "Русский", description: "Весь контент, созданный ИИ, на русском языке." },
  { code: "vi", label: "Vietnamese", native: "Tiếng Việt", description: "Tất cả nội dung do AI tạo ra bằng tiếng Việt." },
  { code: "tl", label: "Filipino", native: "Tagalog", description: "Lahat ng AI-generated na nilalaman sa Filipino." },
] as const;

type LanguageCode = typeof LANGUAGES[number]["code"];

export default function LanguagePreferencesPage() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();

  const [selected, setSelected] = useState<LanguageCode>("auto");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    const lang = (user as any).preferredLanguage as LanguageCode | null | undefined;
    setSelected(lang && lang !== "null" ? lang : "auto");
    setLoaded(true);
  }, [user]);

  const handleSelect = async (code: LanguageCode) => {
    if (code === selected) return;
    setSelected(code);
    setSaving(true);
    try {
      await apiRequest("/api/user/preferences", {
        method: "PATCH",
        body: JSON.stringify({ preferredLanguage: code }),
      });
      await refreshUser?.();
      const lang = LANGUAGES.find((l) => l.code === code);
      toast({
        title: t("language.saved"),
        description: code === "auto"
          ? t("language.savedAutoDesc")
          : t("language.savedLangDesc", { language: lang?.label ?? code }),
      });
    } catch {
      toast({ title: t("language.errorSave"), description: t("language.errorSaveDesc"), variant: "destructive" });
      const lang = (user as any).preferredLanguage as LanguageCode | null | undefined;
      setSelected(lang && lang !== "null" ? lang : "auto");
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-orange-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-orange-950/10 to-black pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-lg border-b border-white/10 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => setLocation("/dashboard")}
          className="p-1.5 rounded-lg bg-white/5 text-white/60 active:bg-white/10"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-orange-400" />
          <h1 className="text-base font-bold text-white">{t("language.pageTitle")}</h1>
        </div>
        {saving && <Loader2 className="w-4 h-4 text-orange-400 animate-spin ml-auto" />}
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6 space-y-5">
        {/* Intro */}
        <div className="rounded-xl border border-orange-700/20 bg-orange-950/20 px-4 py-3">
          <p className="text-xs text-white/60 leading-relaxed">
            {t("language.intro")}
          </p>
        </div>

        {/* Language list */}
        <section className="space-y-2">
          {LANGUAGES.map((lang) => {
            const isActive = selected === lang.code;
            return (
              <button
                key={lang.code}
                onClick={() => handleSelect(lang.code)}
                className={[
                  "w-full text-left rounded-xl border px-4 py-3 transition-colors flex items-start justify-between gap-3",
                  isActive
                    ? "border-orange-500/50 bg-orange-950/40"
                    : "border-white/10 bg-white/5 active:bg-white/10",
                ].join(" ")}
              >
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <p className={["text-sm font-semibold", isActive ? "text-orange-300" : "text-white"].join(" ")}>
                      {lang.native}
                    </p>
                    {lang.code !== "auto" && (
                      <p className="text-xs text-white/40">{lang.label}</p>
                    )}
                  </div>
                  <p className="text-xs text-white/50 mt-0.5 leading-relaxed">{lang.description}</p>
                </div>
                {isActive && (
                  <div className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
              </button>
            );
          })}
        </section>

        {/* Footer note */}
        <p className="text-xs text-white/30 text-center leading-relaxed px-2">
          {t("language.footerNote")}
        </p>
      </div>
    </div>
  );
}
