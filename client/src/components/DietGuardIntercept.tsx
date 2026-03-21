import { Leaf, ChefHat, ArrowLeft } from "lucide-react";
import { DietGuardAlertState, DietGuardDecision } from "@/hooks/useDietGuardPrecheck";

interface DietGuardInterceptProps {
  alert: DietGuardAlertState;
  onDecision: (decision: DietGuardDecision) => void;
  className?: string;
}

function capitalizeDiet(diet: string | null): string {
  if (!diet) return "Diet";
  return diet.charAt(0).toUpperCase() + diet.slice(1);
}

export function DietGuardIntercept({
  alert,
  onDecision,
  className = "",
}: DietGuardInterceptProps) {
  if (!alert.show) return null;

  return (
    <div
      className={`rounded-xl border p-5 bg-neutral-900/80 border-neutral-600/50 backdrop-blur-sm ${className}`}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-full bg-neutral-700/50">
            <Leaf className="h-5 w-5 text-green-400" />
          </div>

          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-neutral-200 mb-1">
              {capitalizeDiet(alert.diet)} Preference
            </h4>

            <p className="text-neutral-400 text-sm mb-3">{alert.message}</p>

            {alert.matchedTerms.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {alert.matchedTerms.map((term, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 bg-neutral-700/50 text-neutral-300 text-xs rounded-full border border-neutral-600/50"
                  >
                    {term}
                  </span>
                ))}
              </div>
            )}

            <p className="text-neutral-500 text-xs">
              Would you like to pick something else, or let the chef create a{" "}
              <span className="text-green-400 font-medium">
                {alert.diet ?? "diet"}-friendly
              </span>{" "}
              version for you?
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => onDecision("pick_something_else")}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-neutral-800/80 border border-neutral-600/50 text-neutral-200 text-sm font-medium transition-all active:scale-[0.98]"
          >
            <ArrowLeft className="h-4 w-4" />
            Pick Something Else
          </button>

          <button
            onClick={() => onDecision("let_chef_adapt")}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-neutral-700/80 border border-neutral-500/50 text-white text-sm font-medium transition-all active:scale-[0.98]"
          >
            <ChefHat className="h-4 w-4" />
            Let Chef Adapt It
          </button>
        </div>
      </div>
    </div>
  );
}

interface DietAdaptedNoticeProps {
  diet: string;
  notice?: string;
  className?: string;
}

export function DietAdaptedNotice({
  diet,
  notice,
  className = "",
}: DietAdaptedNoticeProps) {
  return (
    <div
      className={`rounded-lg px-3 py-2 bg-neutral-800/60 border border-neutral-700/50 flex items-center gap-2 ${className}`}
    >
      <Leaf className="h-3.5 w-3.5 text-green-400 shrink-0" />
      <p className="text-neutral-400 text-xs">
        {notice ?? `Adapted for your ${diet} diet.`}
      </p>
    </div>
  );
}

export type { DietGuardDecision, DietGuardAlertState };
