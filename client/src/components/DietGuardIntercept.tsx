import { ChefHat, ArrowLeft, Leaf } from "lucide-react";

export type DietGuardDecision = "change_request" | "let_chef_adapt";

interface DietGuardInterceptProps {
  show: boolean;
  diet: string;
  onDecision: (decision: DietGuardDecision) => void;
  message?: string;
  className?: string;
}

export function DietGuardIntercept({
  show,
  diet,
  onDecision,
  message,
  className = "",
}: DietGuardInterceptProps) {
  if (!show) return null;

  return (
    <div className={`rounded-xl border p-5 bg-neutral-900/80 border-neutral-600/50 backdrop-blur-sm ${className}`}>
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-full bg-neutral-700/50">
            <Leaf className="h-5 w-5 text-green-400" />
          </div>

          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-neutral-200 mb-1">
              Diet Preference Check
            </h4>
            <p className="text-neutral-400 text-sm mb-2">
              {message ?? `This result may not fully match your ${diet} diet.`}
            </p>
            <p className="text-neutral-500 text-xs">
              Change your request, or let the chef create a{" "}
              <span className="text-green-400 font-medium">{diet}-friendly</span>{" "}
              version for you.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => onDecision("change_request")}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-neutral-800/80 border border-neutral-600/50 text-neutral-200 text-sm font-medium transition-all active:scale-[0.98]"
          >
            <ArrowLeft className="h-4 w-4" />
            Change My Request
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
