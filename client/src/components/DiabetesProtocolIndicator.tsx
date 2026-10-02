import { useTranslation } from "react-i18next";
import { getPersistedDiabeticMemory } from "@/lib/diabeticMemory";

/** Same meal-owned display contract for boards, creators, refinements and Favorites. */
export default function DiabetesProtocolIndicator({
  memory,
  compact = false,
}: {
  memory?: unknown;
  compact?: boolean;
}) {
  const { t } = useTranslation("mealCard");
  const snapshot = getPersistedDiabeticMemory(memory);
  if (!snapshot) return null;
  return (
    <div
      role="note"
      aria-label={t("diabetesProtocol")}
      data-testid="diabetes-protocol-indicator"
      className={compact
        ? "mt-1 text-xs text-lime-400"
        : "mt-2 rounded-lg bg-lime-950/60 border border-lime-700/40 px-3 py-2 text-xs space-y-0.5"}
    >
      <div className="text-lime-400 font-semibold tracking-wide uppercase text-[10px]">
        {t("diabetesProtocol")}
      </div>
      {snapshot.generatedBglMgdl !== null ? (
        <div className={compact ? "text-lime-300" : "text-white/80"}>
          {t("generatedForBGL")}{" "}
          <span className="font-medium">{snapshot.generatedBglMgdl} mg/dL</span>
        </div>
      ) : (
        <div className={compact ? "text-lime-300" : "text-white/80"}>
          {snapshot.version === 2 && snapshot.glucoseState === "STALE"
            ? "No current glucose reading was used"
            : "No glucose reading was available"}
        </div>
      )}
      {!compact && (
        <>
          <div className="text-white/60">{snapshot.protocolTypeLabel}</div>
          {snapshot.recommendedBglRange && (
            <div className="text-white/50 text-[10px]">
              {t("relevantRange")} {snapshot.recommendedBglRange}
            </div>
          )}
        </>
      )}
    </div>
  );
}