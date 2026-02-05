import { Wheat, ChefHat, ArrowLeft } from "lucide-react";
import { StarchGuardAlertState, StarchGuardDecision } from "@/hooks/useStarchGuardPrecheck";

interface StarchGuardInterceptProps {
  alert: StarchGuardAlertState;
  onDecision: (decision: StarchGuardDecision) => void;
  className?: string;
}

export function StarchGuardIntercept({
  alert,
  onDecision,
  className = ""
}: StarchGuardInterceptProps) {
  if (!alert.show) {
    return null;
  }

  return (
    <div className={`rounded-xl border p-5 bg-neutral-900/80 border-neutral-600/50 backdrop-blur-sm ${className}`}>
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-full bg-neutral-700/50">
            <Wheat className="h-5 w-5 text-neutral-300" />
          </div>
          
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-neutral-200 mb-1">
              Starchy Carbs Covered
            </h4>
            
            <p className="text-neutral-400 text-sm mb-3">
              {alert.message}
            </p>
            
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
            
            <p className="text-neutral-500 text-xs mb-4">
              Would you like to order something else, or let Chef pick a fibrous veggie instead?
            </p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => onDecision('order_something_else')}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-neutral-800/80 border border-neutral-600/50 text-neutral-200 text-sm font-medium transition-all active:scale-[0.98]"
          >
            <ArrowLeft className="h-4 w-4" />
            Order Something Else
          </button>
          
          <button
            onClick={() => onDecision('let_chef_pick')}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-neutral-700/80 border border-neutral-500/50 text-white text-sm font-medium transition-all active:scale-[0.98]"
          >
            <ChefHat className="h-4 w-4" />
            Let Chef Pick
          </button>
        </div>
      </div>
    </div>
  );
}

interface StarchSubstitutionNoticeProps {
  originalTerms: string[];
  className?: string;
}

export function StarchSubstitutionNotice({
  originalTerms,
  className = ""
}: StarchSubstitutionNoticeProps) {
  if (originalTerms.length === 0) {
    return null;
  }
  
  const termsList = originalTerms.slice(0, 3).join(', ');
  
  return (
    <div className={`rounded-lg px-3 py-2 bg-neutral-800/60 border border-neutral-700/50 ${className}`}>
      <p className="text-neutral-400 text-xs">
        <span className="text-neutral-300 font-medium">{termsList}</span>
        {' '}was replaced with fibrous veggies to keep your carbs on target.
      </p>
    </div>
  );
}
