import { Leaf, ChefHat, ArrowLeft, ArrowRight, ShieldAlert } from "lucide-react";
import { DietGuardAlertState, DietGuardDecision } from "@/hooks/useDietGuardPrecheck";

interface DietGuardInterceptProps {
  alert: DietGuardAlertState;
  onDecision: (decision: DietGuardDecision) => void;
  className?: string;
}

const CULTURAL_PROTOCOLS = ["kosher", "halal"] as const;
type CulturalProtocol = (typeof CULTURAL_PROTOCOLS)[number];

function isCulturalProtocol(diet: string | null): diet is CulturalProtocol {
  return diet === "kosher" || diet === "halal";
}

function capitalizeDiet(diet: string | null): string {
  if (!diet) return "Diet";
  return diet.charAt(0).toUpperCase() + diet.slice(1);
}

// Badge color class by protocol
function getProtocolColor(diet: string | null): string {
  if (diet === "kosher") return "text-amber-400";
  if (diet === "halal") return "text-teal-400";
  return "text-green-400";
}

// Icon background by protocol
function getIconBgClass(diet: string | null): string {
  if (diet === "kosher") return "bg-amber-900/40";
  if (diet === "halal") return "bg-teal-900/40";
  return "bg-neutral-700/50";
}

export function DietGuardIntercept({
  alert,
  onDecision,
  className = "",
}: DietGuardInterceptProps) {
  if (!alert.show) return null;

  const isCultural = isCulturalProtocol(alert.diet);
  const protocolColor = getProtocolColor(alert.diet);
  const iconBgClass = getIconBgClass(alert.diet);

  // Show "Let Chef Adapt It" unless the rule explicitly forbids adaptation.
  // undefined means adaptable — only isAdaptable: false (hard-blocked rules) hides the button.
  const showAdaptButton = alert.isAdaptable !== false;

  const headingText = isCultural
    ? "Protocol Conflict"
    : `${capitalizeDiet(alert.diet)} Preference`;

  const subText = isCultural
    ? alert.isAdaptable
      ? `Chef can fix this for you — would you like to pick something else, or let the chef adapt it to your ${alert.diet} protocol?`
      : `This ingredient requires certification certainty the app cannot provide. Please pick something else.`
    : `You can continue anyway with your request, or let the chef create a diet-friendly version for you.`;

  return (
    <div
      className={`rounded-xl border p-5 bg-neutral-900/80 border-neutral-600/50 backdrop-blur-sm ${className}`}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div className={`p-2.5 rounded-full ${iconBgClass}`}>
            {isCultural ? (
              <ShieldAlert className={`h-5 w-5 ${protocolColor}`} />
            ) : (
              <Leaf className={`h-5 w-5 ${protocolColor}`} />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-neutral-200 mb-1">
              {headingText}
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

            {alert.suggestedSubstitute && (
              <p className={`text-xs mb-3 ${protocolColor} opacity-80`}>
                {alert.suggestedSubstitute}
              </p>
            )}

            <p className="text-neutral-500 text-xs">{subText}</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          {isCultural ? (
            <button
              onClick={() => onDecision("pick_something_else")}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-neutral-800/80 border border-neutral-600/50 text-neutral-200 text-sm font-medium transition-all active:scale-[0.98]"
            >
              <ArrowLeft className="h-4 w-4" />
              Pick Something Else
            </button>
          ) : (
            <button
              onClick={() => onDecision("continue_anyway")}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-neutral-800/80 border border-neutral-600/50 text-neutral-200 text-sm font-medium transition-all active:scale-[0.98]"
            >
              <ArrowRight className="h-4 w-4" />
              Continue Anyway
            </button>
          )}

          {showAdaptButton && (
            <button
              onClick={() => onDecision("let_chef_adapt")}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-neutral-700/80 border border-neutral-500/50 text-white text-sm font-medium transition-all active:scale-[0.98]"
            >
              <ChefHat className="h-4 w-4" />
              Let Chef Adapt It
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface DietAdaptedNoticeProps {
  diet: string;
  // Legacy props — accepted for backward compat but no longer used in display
  notice?: string;
  swapDetail?: string;
  message?: string;
  onDismiss?: () => void;
  className?: string;
}

export function DietAdaptedNotice({
  diet,
  className = "",
}: DietAdaptedNoticeProps) {
  const isCultural = diet === "kosher" || diet === "halal";
  const iconColor = diet === "kosher" ? "text-amber-400" : diet === "halal" ? "text-teal-400" : "text-green-400";
  const borderColor = diet === "kosher" ? "border-amber-500/30" : diet === "halal" ? "border-teal-500/30" : "border-green-500/30";

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-neutral-800/70 border ${borderColor} text-xs font-medium whitespace-nowrap ${className}`}
    >
      {isCultural ? (
        <ShieldAlert className={`h-3 w-3 ${iconColor} shrink-0`} />
      ) : (
        <Leaf className={`h-3 w-3 ${iconColor} shrink-0`} />
      )}
      <span className={iconColor}>Chef Adapted</span>
    </span>
  );
}

export type { DietGuardDecision, DietGuardAlertState };
