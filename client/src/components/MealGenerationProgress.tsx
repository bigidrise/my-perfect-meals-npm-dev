import ThinkingDots from "@/components/ThinkingDots";
import { useMealGenerationProgress } from "@/hooks/useMealGenerationProgress";
import type {
  MealGenerationContext,
  MealGenerationMode,
} from "@/lib/mealGenerationProgress";

interface MealGenerationProgressProps {
  active?: boolean;
  context?: MealGenerationContext;
  mode?: MealGenerationMode;
  className?: string;
  intervalMs?: number;
}

export default function MealGenerationProgress({
  active = true,
  context = "general",
  mode = "single",
  className = "",
  intervalMs = 5000,
}: MealGenerationProgressProps) {
  const { title, message } = useMealGenerationProgress(
    active,
    context,
    mode,
    intervalMs,
  );
  if (!active) return null;

  return (
    <div
      className={`meal-generation-progress min-h-[8.5rem] flex flex-col items-center justify-center text-center ${className}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-testid="meal-generation-progress"
    >
      <ThinkingDots label="" />
      <p className="text-sm font-semibold text-white/90">{title}</p>
      <p className="mt-2 min-h-[2.5rem] max-w-md px-4 text-sm leading-5 text-white/60">
        {message}
      </p>
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          .meal-generation-progress * {
            animation-duration: 0.001ms !important;
            animation-iteration-count: 1 !important;
          }
        }
      `}</style>
    </div>
  );
}