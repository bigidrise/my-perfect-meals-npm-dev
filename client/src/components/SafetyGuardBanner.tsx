import { AlertTriangle, Shield, X } from "lucide-react";

export interface SafetyAlertState {
  show: boolean;
  result: "SAFE" | "BLOCKED" | "AMBIGUOUS";
  blockedTerms: string[];
  blockedCategories: string[];
  ambiguousTerms: string[];
  message: string;
  suggestion?: string;
}

interface SafetyGuardBannerProps {
  alert: SafetyAlertState;
  mealRequest: string;
  onDismiss: () => void;
  onOverrideSuccess: (token: string) => void;
  className?: string;
}

export function SafetyGuardBanner({
  alert,
  mealRequest,
  onDismiss,
  onOverrideSuccess,
  className = ""
}: SafetyGuardBannerProps) {
  if (!alert.show || alert.result === "SAFE") {
    return null;
  }

  const isBlocked = alert.result === "BLOCKED";

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
              {isBlocked ? "⚠️ Allergy Protection Active" : "⚠️ Ingredient Warning"}
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
