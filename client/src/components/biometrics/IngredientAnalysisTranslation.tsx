import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useConsumerCopy } from "@/i18n/useConsumerCopy";
import { apiRequest } from "@/lib/queryClient";
import type { IngredientScanResult } from "@/lib/photoIngredientCapture";
import { ingredientAnalysisCopy, translateIngredientAnalysisCopy } from "@/lib/ingredientAnalysisTranslation";
import { ingredientAnalysisTranslationEnabled } from "@/lib/ingredientAnalysisTranslationGate";
import { isBuiltInAnalysisLabel } from "@/i18n/ingredientAnalysisLabels";

type State = { key: string; phase: "loading" | "ready" | "error"; copy: Record<string, string> };
const TranslationContext = createContext<{
  text: (source: string) => string; phase?: State["phase"]; retry?: () => void;
}>({ text: source => source });

/** Only text nodes use this context. Save/Add callbacks always retain original objects. */
export function IngredientAnalysisText({ text }: { text: string }) {
  const display = useContext(TranslationContext);
  return ingredientAnalysisTranslationEnabled && isBuiltInAnalysisLabel(text)
    ? <BuiltInAnalysisLabel text={text} /> : <>{display.text(text)}</>;
}

function BuiltInAnalysisLabel({ text }: { text: string }) {
  const { t } = useConsumerCopy();
  return <>{t(text)}</>;
}
export function IngredientAnalysisTranslationStatus() {
  const { phase, retry } = useContext(TranslationContext);
  const { t } = useConsumerCopy();
  if (!phase) return null;
  return <div className="text-xs text-white/65 mb-3" role="status" aria-live="polite">
    {phase === "loading" ? t("Translating analysis explanations…")
      : phase === "ready" ? t("Translation of the original analysis.")
      : t("Analysis translation is unavailable. Showing the original text.")}
    {phase === "error" && <button type="button" onClick={retry} className="ml-2 underline">
      {t("Retry translation")}
    </button>}
  </div>;
}

export function IngredientAnalysisTranslation({ open, owner, result, extra, children }: {
  open: boolean; owner: string | null; result: IngredientScanResult | null;
  extra: string[]; children: ReactNode;
}) {
  const { i18n } = useTranslation();
  const language = i18n?.resolvedLanguage ?? i18n?.language ?? "en";
  const source = ingredientAnalysisCopy(result, extra);
  const enabled = ingredientAnalysisTranslationEnabled && open && !!owner
    && language.split("-")[0] === "es" && source.texts.length > 0;
  const key = JSON.stringify([owner, language, source]);
  const [state, setState] = useState<State>();
  const [attempt, setAttempt] = useState(0);
  const cache = useRef(new Map<string, Record<string, string>>());
  useEffect(() => { cache.current.clear(); }, [owner]);
  useEffect(() => {
    if (!enabled) return;
    let current = true;
    const saved = cache.current.get(key);
    if (saved) {
      setState({ key, phase: "ready", copy: saved });
      return;
    }
    setState({ key, phase: "loading", copy: {} });
    const [, , copy] = JSON.parse(key) as [unknown, unknown, typeof source];
    translateIngredientAnalysisCopy(copy.texts, copy.names, content => apiRequest("/api/translate", {
      method: "POST", body: JSON.stringify({ content, targetLanguage: "es" }),
    })).then(translated => {
      if (!current) return;
      if (cache.current.size >= 4) cache.current.delete(cache.current.keys().next().value!);
      cache.current.set(key, translated);
      setState({ key, phase: "ready", copy: translated });
    }).catch(() => {
      if (current) setState({ key, phase: "error", copy: {} });
    });
    return () => { current = false; };
  }, [enabled, key, attempt]);
  const active = enabled && state?.key === key ? state : undefined;
  return <TranslationContext.Provider value={{
    text: text => active?.phase === "ready" ? active.copy[text] ?? text : text,
    phase: enabled ? active?.phase ?? "loading" : undefined,
    retry: () => setAttempt(n => n + 1),
  }}>{children}</TranslationContext.Provider>;
}
