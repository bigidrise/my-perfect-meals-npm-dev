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
};

export function NutritionPrioritiesSelector({
  selectedPriorityIds,
  onChange,
  disabled = false,
  isLoading = false,
  error = null,
  onRetry,
  compact = false,
}: NutritionPrioritiesSelectorProps) {
  const [learnMore, setLearnMore] = useState<FoodInclusionPriorityDefinition | null>(null);

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
        {ACTIVE_NUTRITION_PRIORITY_DEFINITIONS.map((definition) => {
          const selected = selectedPriorityIds.includes(definition.id);
          return (
            <div
              key={definition.id}
              className={`relative rounded-2xl border transition-all ${
                selected
                  ? "border-orange-400 bg-orange-500/20 shadow-[0_0_0_1px_rgba(251,146,60,0.2)]"
                  : "border-white/15 bg-white/5 hover:border-white/30"
              }`}
            >
              <button
                type="button"
                aria-pressed={selected}
                disabled={disabled}
                onClick={() => onChange(toggleNutritionPrioritySelection(selectedPriorityIds, definition.id))}
                className={`w-full text-left rounded-2xl p-4 pr-12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 disabled:opacity-60 ${
                  compact ? "min-h-[104px]" : "min-h-[124px]"
                }`}
              >
                <span className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                      selected ? "border-orange-300 bg-orange-500 text-white" : "border-white/30 bg-black/20"
                    }`}
                  >
                    {selected && <Check className="h-4 w-4" />}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-white">{definition.label}</span>
                    <span className="mt-1 block text-xs leading-relaxed text-white/65">{definition.shortSummary}</span>
                  </span>
                </span>
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => setLearnMore(definition)}
                className="absolute right-3 top-3 rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
                aria-label={`Learn more about ${definition.label}`}
              >
                <Info className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => setLearnMore(definition)}
                className="absolute bottom-3 left-[3.25rem] text-xs font-medium text-orange-300 hover:text-orange-200 focus-visible:outline-none focus-visible:underline"
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
        description={learnMore?.shortSummary}
        className="bg-zinc-950 text-white border-white/20"
        footer={<Button className="w-full bg-orange-500 text-white hover:bg-orange-600" onClick={() => setLearnMore(null)}>Done</Button>}
      >
        {learnMore && (
          <div className="space-y-5 text-sm">
            <EducationSection title="What is this?" text={learnMore.whatItIs} />
            <EducationSection title="Why might I choose this?" text={learnMore.whyChooseIt} />
            <EducationSection title="What will My Perfect Meals do?" text={learnMore.whatMpmDoes} />
            <div>
              <h3 className="font-semibold text-white">Food examples</h3>
              <p className="mt-1 leading-relaxed text-white/70">{learnMore.foodExamples.join(", ")}.</p>
            </div>
            <div>
              <h3 className="font-semibold text-white">Important limitations</h3>
              <ul className="mt-2 space-y-2 text-white/70">
                {learnMore.limitations.map((limitation) => <li key={limitation}>• {limitation}</li>)}
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-white">Sources</h3>
              <ul className="mt-2 space-y-2">
                {learnMore.citations.map((citation) => (
                  <li key={citation.url}>
                    <a href={citation.url} target="_blank" rel="noreferrer" className="text-orange-300 underline underline-offset-2 hover:text-orange-200">
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
