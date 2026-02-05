import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StarchGuardAlertState, StarchGuardDecision } from "@/hooks/useStarchGuardPrecheck";

interface StarchGuardBannerProps {
  alert: StarchGuardAlertState;
  onDismiss: () => void;
  onDecision: (decision: StarchGuardDecision) => void;
  className?: string;
}

export function StarchGuardBanner({
  alert,
  onDismiss,
  onDecision,
  className = ""
}: StarchGuardBannerProps) {
  if (!alert.show) {
    return null;
  }

  return (
    <div className={`rounded-lg border p-4 bg-orange-950/60 border-orange-500/50 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-full bg-orange-500/20 text-2xl">
          🥔
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h4 className="font-semibold text-orange-400">
              Starchy Carbs at Daily Limit
            </h4>
            <button 
              onClick={onDismiss}
              className="text-white/50 hover:text-white/80 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          
          <p className="text-orange-200/90 text-sm mb-3">
            {alert.message}
          </p>
          
          {alert.matchedTerms.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {alert.matchedTerms.map((term, i) => (
                <span 
                  key={i}
                  className="px-2 py-0.5 bg-orange-500/20 text-orange-300 text-xs rounded-full border border-orange-500/30"
                >
                  {term}
                </span>
              ))}
            </div>
          )}
          
          <p className="text-white/60 text-xs mb-4">
            What would you like to do?
          </p>
          
          <div className="flex flex-col gap-2">
            <Button
              onClick={() => onDecision('order_something_else')}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white"
            >
              Order Something Else
            </Button>
            <Button
              onClick={() => onDecision('let_chef_pick')}
              variant="outline"
              className="w-full bg-black/40 border-orange-500/30 text-orange-200 hover:bg-orange-500/20"
            >
              Let Chef Pick a Low-Carb Alternative
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
