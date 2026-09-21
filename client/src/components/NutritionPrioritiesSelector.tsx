import { useState } from "react";
import { Check, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InformationModal } from "@/components/ui/universal-modal";
import {
  FOOD_INCLUSION_PRIORITY_REGISTRY,
  type FoodInclusionPriorityDefinition,
  type FoodInclusionPriorityId,
} from "@shared/nutritionPriorities";

export const ACTIVE_NUTRITION_PRIORITY_DEFINITIONS = Object.values(
  FOOD_INCLUSION_PRIORITY_REGISTRY,
).filter((definition) => definition.status === "active");

export function toggleNutritionPrioritySelection(
  current: FoodInclusionPriorityId[],
  id: FoodInclusionPriorityId,
): FoodInclusionPriorityId[] {
  return current.includes(id)
    ? current.filter((item) => item !== id)
    : [...current, id];
}

type NutritionPrioritiesSelectorProps = {
  selectedPriorityIds: FoodInclusionPriorityId[];
  onChange: (ids: FoodInclusionPriorityId[]) => void;
  disabled?: boolean;
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  compact?: boolean;
  audience?: "adult" | "pediatric";
  accent?: "orange" | "emerald";
};

export function NutritionPrioritiesSelector({
  selectedPriorityIds,
  onChange,
  disabled = false,
  isLoading = false,
  error = null,
  onRetry,
  compact = false,
  audience = "adult",
  accent = "orange",
}: NutritionPrioritiesSelectorProps) {
  const [learnMore, setLearnMore] = useState<FoodInclusionPriorityDefinition | null>(null);
  const accentStyles = accent === "emerald"
    ? {
        selected: "border-emerald-400 bg-emerald-500/20 shadow-[0_0_0_1px_rgba(52,211,153,0.2)]",
        checkbox: "border-emerald-300 bg-emerald-500 text-white",
        focus: "focus-visible:ring-emerald-400",
        link: "text-emerald-300 hover:text-emerald-200",
        button: "bg-emerald-600 text-white hover:bg-emerald-700",
      }
    : {
        selected: "border-orange-400 bg-orange-500/20 shadow-[0_0_0_1px_rgba(251,146,60,0.2)]",
        checkbox: "border-orange-300 bg-orange-500 text-white",
        focus: "focus-visible:ring-orange-400",
        link: "text-orange-300 hover:text-orange-200",
        button: "bg-orange-500 text-white hover:bg-orange-600",
      };
  const definitions = ACTIVE_NUTRITION_PRIORITY_DEFINITIONS.filter(
    (definition) => audience === "adult" || definition.pediatricProjection.status === "approved",
  );

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" aria-label="Loading Nutrition Priorities">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 rounded-2xl border border-white/10 bg-white/5 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="rounded-xl border border-red-400/30 bg-red-950/30 p-4 text-center">
        <p className="text-sm font-medium text-red-100">We couldn't load your Nutrition Priorities.</p>
        <p className="mt-1 text-xs text-red-100/70">Your existing choices have not been changed.</p>
        {onRetry && (
          <Button type="button" variant="outline" className="mt-3 border-red-300/40 bg-black/20 text-white" onClick={onRetry}>
            Try Again
          </Button>
        )}
      </div>
    );
  }

  return (
    <>
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${compact ? "gap-2" : "gap-3"}`}>
        {definitions.map((definition) => {
          const selected = selectedPriorityIds.includes(definition.id);
          const summary = audience === "pediatric"
            ? definition.pediatricProjection.shortSummary
            : definition.shortSummary;
          return (
            <div
              key={definition.id}
              className={`relative rounded-2xl border transition-all ${
                selected
                  ? accentStyles.selected
                  : "border-white/15 bg-white/5 hover:border-white/30"
              }`}
            >
              <button
                type="button"
                aria-pressed={selected}
                disabled={disabled}
                onClick={() => onChange(toggleNutritionPrioritySelection(selectedPriorityIds, definition.id))}
                className={`w-full text-left rounded-2xl p-4 pr-12 focus-visible:outline-none focus-visible:ring-2 disabled:opacity-60 ${accentStyles.focus} ${
                  compact ? "min-h-[104px]" : "min-h-[124px]"
                }`}
              >
                <span className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                      selected ? accentStyles.checkbox : "border-white/30 bg-black/20"
                    }`}
                  >
                    {selected && <Check className="h-4 w-4" />}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-white">{definition.label}</span>
                    <span className="mt-1 block text-xs leading-relaxed text-white/65">{summary}</span>
                  </span>
                </span>
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => setLearnMore(definition)}
                className={`absolute right-3 top-3 rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 ${accentStyles.focus}`}
                aria-label={`Learn more about ${definition.label}`}
              >
                <Info className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => setLearnMore(definition)}
                className={`absolute bottom-3 left-[3.25rem] text-xs font-medium focus-visible:outline-none focus-visible:underline ${accentStyles.link}`}
              >
                Learn More
              </button>
            </div>
          );
        })}
      </div>

      <InformationModal
        open={Boolean(learnMore)}
        onOpenChange={(open) => { if (!open) setLearnMore(null); }}
        title={learnMore?.label ?? "Nutrition Priority"}
        description={learnMore
          ? audience === "pediatric"
            ? learnMore.pediatricProjection.shortSummary
            : learnMore.shortSummary
          : undefined}
        className="bg-zinc-950 text-white border-white/20"
        footer={<Button className={`w-full ${accentStyles.button}`} onClick={() => setLearnMore(null)}>Done</Button>}
      >
        {learnMore && (
          <div className="space-y-5 text-sm">
            <EducationSection title="What is this?" text={learnMore.whatItIs} />
            <EducationSection
              title={audience === "pediatric" ? "Why might I choose this for my child?" : "Why might I choose this?"}
              text={audience === "pediatric" ? learnMore.pediatricProjection.whyChooseIt : learnMore.whyChooseIt}
            />
            <EducationSection
              title="What will My Perfect Meals do?"
              text={audience === "pediatric" ? learnMore.pediatricProjection.whatMpmDoes : learnMore.whatMpmDoes}
            />
            <div>
              <h3 className="font-semibold text-white">Food examples</h3>
              <p className="mt-1 leading-relaxed text-white/70">{learnMore.foodExamples.join(", ")}.</p>
            </div>
            <div>
              <h3 className="font-semibold text-white">Important limitations</h3>
              <ul className="mt-2 space-y-2 text-white/70">
                {(audience === "pediatric"
                  ? learnMore.pediatricProjection.limitations
                  : learnMore.limitations
                ).map((limitation) => <li key={limitation}>• {limitation}</li>)}
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-white">Sources</h3>
              <ul className="mt-2 space-y-2">
                {learnMore.citations.map((citation) => (
                  <li key={citation.url}>
                    <a href={citation.url} target="_blank" rel="noreferrer" className={`${accentStyles.link} underline underline-offset-2`}>
                      {citation.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </InformationModal>
    </>
  );
}

function EducationSection({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h3 className="font-semibold text-white">{title}</h3>
      <p className="mt-1 leading-relaxed text-white/70">{text}</p>
    </div>
  );
}
