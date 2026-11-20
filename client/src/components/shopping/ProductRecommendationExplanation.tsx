import { IngredientAnalysisText } from "@/components/biometrics/IngredientAnalysisTranslation";

/** Shared Find a Product explanation; never renders a save or selection action. */
export function ProductRecommendationExplanation({ whyBetter, targetCriteria, marker }: {
  whyBetter: readonly string[];
  targetCriteria: string;
  marker?: string;
}) {
  return <>
    {whyBetter.length > 0 && <div className="flex flex-wrap gap-1.5 mb-2">
      {whyBetter.map((why, index) => <span key={`${index}-${why}`} className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-300 bg-emerald-500/15 border border-emerald-500/25 rounded-full px-2 py-0.5">
        <span className="text-[9px] font-bold">✓</span>
        <IngredientAnalysisText text={why} />
      </span>)}
    </div>}
    {targetCriteria && <p className="text-[11px] text-white/50 leading-snug border-t border-white/8 pt-2">
      {marker}
      <IngredientAnalysisText text={targetCriteria} />
    </p>}
  </>;
}
