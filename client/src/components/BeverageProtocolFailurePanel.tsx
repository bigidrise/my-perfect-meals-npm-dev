import { ShieldCheck, Sparkles, WineOff } from "lucide-react";
import { useTranslation } from "react-i18next";

export type BeverageRejectionKind =
  | "alcohol_forbidden"
  | "macro_noncompliant"
  | "other";

export interface BeverageAlternative {
  name: string;
  description?: string;
  ingredients: Array<{
    name?: string;
    item?: string;
    amount?: string;
    unit?: string;
    displayText?: string;
  }>;
  instructions?: string | string[];
  nutrition?: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
  };
  servingSize?: string;
  reasoning: string;
  imageUrl?: string | null;
}

export interface BeverageProtocolFailure {
  error: "PROTOCOL_VIOLATION" | "CLINICAL_VIOLATION";
  message?: string;
  retryable: true;
  rejectionKind?: BeverageRejectionKind;
  protocolName?: string | null;
  violations?: string[];
  alternatives: BeverageAlternative[];
}

export function isBeverageProtocolFailure(
  payload: unknown,
): payload is BeverageProtocolFailure {
  if (!payload || typeof payload !== "object") return false;
  const value = payload as Record<string, unknown>;
  return (
    value.retryable === true &&
    (value.error === "PROTOCOL_VIOLATION" || value.error === "CLINICAL_VIOLATION")
  );
}

interface BeverageProtocolFailurePanelProps {
  failure: BeverageProtocolFailure;
  onUseAlternative: (alternative: BeverageAlternative) => void;
  onRetry: () => void;
  onAdjustPreferences: () => void;
  isRetrying?: boolean;
}

export function BeverageProtocolFailurePanel({
  failure,
  onUseAlternative,
  onRetry,
  onAdjustPreferences,
  isRetrying = false,
}: BeverageProtocolFailurePanelProps) {
  const { t } = useTranslation();
  const alcoholBlocked = failure.rejectionKind === "alcohol_forbidden";
  const protocolName = failure.protocolName?.trim();

  return (
    <section
      className="mt-3 rounded-xl border border-emerald-400/35 bg-emerald-950/45 p-4 space-y-4"
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 text-emerald-300 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-1">
          <h3 className="font-semibold text-emerald-100">
            {protocolName
              ? t("beverageSafety.titleWithProtocol", { protocol: protocolName })
              : t("beverageSafety.title")}
          </h3>
          <p className="text-sm text-emerald-100/90">
            {t("beverageSafety.description")}
          </p>
          {failure.message && (
            <p className="text-xs text-emerald-100/75 leading-relaxed">
              {failure.message}
            </p>
          )}
        </div>
      </div>

      <div className="border-t border-emerald-300/15 pt-3">
        <h4 className="font-semibold text-white flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-emerald-300" aria-hidden="true" />
          {t("beverageSafety.alternativesHeading")}
        </h4>
        <p className="mt-1 text-sm text-white/75">
          {t("beverageSafety.alternativesIntro")}
        </p>
        {alcoholBlocked && (
          <p className="mt-2 flex items-start gap-2 text-xs text-amber-100/90">
            <WineOff className="h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
            {t("beverageSafety.alcoholFreeNote")}
          </p>
        )}
      </div>

      {failure.alternatives.length > 0 ? (
        <div className="space-y-3">
          {failure.alternatives.map((alternative, index) => (
            <article
              key={`${alternative.name}-${index}`}
              className="rounded-lg border border-white/15 bg-black/25 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h5 className="font-semibold text-white">{alternative.name}</h5>
                  {alternative.description && (
                    <p className="mt-1 text-sm text-white/75">
                      {alternative.description}
                    </p>
                  )}
                </div>
                {alternative.nutrition && (
                  <span className="shrink-0 text-xs text-emerald-100/80">
                    {Number(alternative.nutrition.calories ?? 0)} kcal
                  </span>
                )}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-emerald-100/85">
                {alternative.reasoning}
              </p>
              <p className="mt-2 text-xs text-white/60">
                {alternative.ingredients
                  .slice(0, 4)
                  .map((ingredient) =>
                    ingredient.displayText ||
                    [ingredient.amount, ingredient.unit, ingredient.name || ingredient.item]
                      .filter(Boolean)
                      .join(" "),
                  )
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <button
                type="button"
                onClick={() => onUseAlternative(alternative)}
                className="mt-3 w-full rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500"
              >
                {t("beverageSafety.useOption")}
              </button>
            </article>
          ))}
        </div>
      ) : (
        <p className="rounded-lg bg-black/20 px-3 py-2 text-sm text-white/75">
          {t("beverageSafety.noAlternatives")}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onRetry}
          disabled={isRetrying}
          className="flex-1 min-w-[180px] rounded-md bg-white/10 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/20 disabled:opacity-50"
        >
          {t("beverageSafety.makeBetterFit")}
        </button>
        <button
          type="button"
          onClick={onAdjustPreferences}
          className="flex-1 min-w-[160px] rounded-md border border-white/20 px-3 py-2 text-sm font-medium text-white/85 transition-colors hover:bg-white/10"
        >
          {t("beverageSafety.adjustPreferences")}
        </button>
      </div>
    </section>
  );
}