import { ChefHat, ArrowLeft } from "lucide-react";
import { getBuilderLabel } from "@/lib/builderGuardrailConfig";

interface BuilderOverrideDialogProps {
  show: boolean;
  conflictingItem: string;
  builderType: string;
  onKeepOnPlan: () => void;
  onMakeItAnyway: () => void;
  className?: string;
}

/**
 * Coach-style override dialog for builder guardrail conflicts.
 *
 * Shown when a user explicitly requests an item that conflicts with their
 * active builder plan (anti-inflammatory, GLP-1, diabetic, etc.).
 *
 * Identity diets (vegan, kosher, halal, etc.) are NEVER shown this dialog —
 * those are enforced silently via DietGuardIntercept.
 */
export function BuilderOverrideDialog({
  show,
  conflictingItem,
  builderType,
  onKeepOnPlan,
  onMakeItAnyway,
  className = "",
}: BuilderOverrideDialogProps) {
  if (!show) return null;

  const planLabel = getBuilderLabel(builderType);

  return (
    <div
      className={`rounded-xl border p-5 bg-neutral-900/80 border-neutral-600/50 backdrop-blur-sm ${className}`}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-full bg-amber-900/30">
            <ChefHat className="h-5 w-5 text-amber-400" />
          </div>

          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-neutral-200 mb-1">
              {planLabel} Plan
            </h4>

            <p className="text-neutral-400 text-sm mb-3">
              That's not part of your current plan, but I can still help you with it.
            </p>

            <div className="flex flex-wrap gap-1.5 mb-3">
              <span className="px-2.5 py-1 bg-neutral-700/50 text-neutral-300 text-xs rounded-full border border-neutral-600/50 capitalize">
                {conflictingItem}
              </span>
            </div>

            <p className="text-neutral-500 text-xs">
              I'll adjust the preparation and sides to fit your plan as closely as possible.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onKeepOnPlan}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-neutral-800/80 border border-neutral-600/50 text-neutral-200 text-sm font-medium transition-all active:scale-[0.98]"
          >
            <ArrowLeft className="h-4 w-4" />
            Keep it on plan
          </button>

          <button
            onClick={onMakeItAnyway}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-amber-700/70 border border-amber-600/50 text-white text-sm font-medium transition-all active:scale-[0.98]"
          >
            <ChefHat className="h-4 w-4" />
            Make it anyway
          </button>
        </div>
      </div>
    </div>
  );
}
