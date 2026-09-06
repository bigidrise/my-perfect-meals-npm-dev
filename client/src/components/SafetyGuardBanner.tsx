import { AlertTriangle, Shield, X } from "lucide-react";

export interface SafetyAlertState {
  show: boolean;
  result: "SAFE" | "BLOCKED" | "AMBIGUOUS" | "ADVISORY";
  blockedTerms: string[];
  blockedCategories: string[];
  ambiguousTerms: string[];
  message: string;
  suggestion?: string;
  reasonCode?: string;
  enforcementLevel?: "advisory" | "hard_block";
  overrideAllowed?: boolean;
  requestedFood?: string;
  recommendedAlternative?: string;
}

interface SafetyGuardBannerProps {
  alert: SafetyAlertState;
  mealRequest: string;
  onDismiss: () => void;
  onOverrideSuccess: (token: string) => void;
  onContinueAnyway?: () => void | Promise<void>;
  onAcceptAlternative?: () => void | Promise<void>;
  continuingAnyway?: boolean;
  className?: string;
}

export function SafetyGuardBanner({
  alert,
  mealRequest,
  onDismiss,
  onOverrideSuccess,
  onContinueAnyway,
  onAcceptAlternative,
  continuingAnyway = false,
  className = ""
}: SafetyGuardBannerProps) {
  if (!alert.show || alert.result === "SAFE") {
    return null;
  }

  const isBlocked = alert.result === "BLOCKED";
  const isAdvisory = alert.result === "ADVISORY";

  return (
    <div className={`rounded-lg border p-4 ${isBlocked ? "bg-amber-950/50 border-amber-500/50" : "bg-yellow-950/50 border-yellow-500/50"} ${className}`}>
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-full ${isBlocked ? "bg-amber-500/20" : "bg-yellow-500/20"}`}>
          {isBlocked ? (
            <Shield className="h-5 w-5 text-amber-400" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-yellow-400" />
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h4 className={`font-semibold ${isBlocked ? "text-amber-400" : "text-yellow-400"}`}>
              {isBlocked ? "⚠️ Allergy Protection Active" : isAdvisory ? "Saved Food Avoidance" : "⚠️ Ingredient Warning"}
            </h4>
            <button 
              onClick={onDismiss}
              className="text-white/50 hover:text-white/80 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          
          <p className="text-amber-200/90 text-sm mb-2">
            {alert.message}
          </p>
          
          {alert.blockedTerms.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {alert.blockedTerms.map((term, i) => (
                <span 
                  key={i}
                  className="px-2 py-0.5 bg-amber-500/20 text-amber-300 text-xs rounded-full border border-amber-500/30"
                >
                  {term}
                </span>
              ))}
            </div>
          )}
          
          {alert.suggestion && (
            <p className="text-white/60 text-xs">
              💡 Suggestion: {alert.suggestion}
            </p>
          )}

          {isAdvisory && alert.overrideAllowed && onContinueAnyway && (
            <div className="mt-3 flex flex-wrap gap-2">
              {onAcceptAlternative && (
                <button
                  type="button"
                  onClick={onAcceptAlternative}
                  disabled={continuingAnyway}
                  className="rounded-lg border border-emerald-400/60 bg-emerald-950/60 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-900/70 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Use recommended alternative
                </button>
              )}
              <button
                type="button"
                onClick={onContinueAnyway}
                disabled={continuingAnyway}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {continuingAnyway ? "Recording acknowledgement..." : "Continue anyway"}
              </button>
              <span className="self-center text-xs text-white/60">
                This applies only to this request. All safety protections remain active.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const EMPTY_SAFETY_ALERT: SafetyAlertState = {
  show: false,
  result: "SAFE",
  blockedTerms: [],
  blockedCategories: [],
  ambiguousTerms: [],
  message: ""
};
