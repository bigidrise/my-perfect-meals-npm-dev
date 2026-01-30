import { Activity, AlertTriangle, Heart, TrendingDown, X } from "lucide-react";

export type GlucoseState = 
  | "low"
  | "low-normal"
  | "in-range"
  | "elevated"
  | "high-risk"
  | "stale"
  | "none";

interface GlucoseGuardBannerProps {
  state: GlucoseState;
  bgl: number | null;
  onDismiss?: () => void;
  className?: string;
}

function getGuidanceMessage(state: GlucoseState, bgl: number | null): string {
  switch (state) {
    case "low":
      return `Your blood sugar is low (${bgl} mg/dL). This meal will include adequate carbs to help stabilize your levels.`;
    case "low-normal":
      return `Your blood sugar is in the lower-normal range (${bgl} mg/dL). This meal will include balanced carbs to maintain stable levels.`;
    case "in-range":
      return `Your blood sugar is in optimal range (${bgl} mg/dL). This meal is designed to maintain your good control.`;
    case "elevated":
      return `Your blood sugar is elevated (${bgl} mg/dL). This meal will be lower in carbs to help bring levels down.`;
    case "high-risk":
      return `Your blood sugar is high (${bgl} mg/dL). This meal will be very low in carbs with emphasis on protein and fiber.`;
    case "stale":
      return "Your last glucose reading is over 4 hours old. Consider logging a fresh reading for better meal guidance.";
    case "none":
      return "No recent glucose reading. Log your blood sugar in the Diabetic Hub for personalized meal guidance.";
  }
}

export function GlucoseGuardBanner({
  state,
  bgl,
  onDismiss,
  className = ""
}: GlucoseGuardBannerProps) {
  if (state === "none") {
    return null;
  }

  const isLow = state === "low";
  const isHigh = state === "elevated" || state === "high-risk";
  const isInRange = state === "in-range" || state === "low-normal";
  const isStale = state === "stale";

  const getBannerStyles = () => {
    if (isLow) return "bg-rose-950/50 border-rose-500/50";
    if (isHigh) return "bg-amber-950/50 border-amber-500/50";
    if (isInRange) return "bg-teal-950/50 border-teal-400/50";
    return "bg-gray-800/50 border-gray-500/50";
  };

  const getIconBgStyles = () => {
    if (isLow) return "bg-rose-500/20";
    if (isHigh) return "bg-amber-500/20";
    if (isInRange) return "bg-teal-500/20";
    return "bg-gray-500/20";
  };

  const getTitleStyles = () => {
    if (isLow) return "text-rose-400";
    if (isHigh) return "text-amber-400";
    if (isInRange) return "text-teal-400";
    return "text-gray-400";
  };

  const getIcon = () => {
    if (isLow) return <TrendingDown className="h-5 w-5 text-rose-400" />;
    if (isHigh) return <AlertTriangle className="h-5 w-5 text-amber-400" />;
    if (isInRange) return <Heart className="h-5 w-5 text-teal-400" />;
    return <Activity className="h-5 w-5 text-gray-400" />;
  };

  const getTitle = () => {
    if (isLow) return "Low Blood Sugar Detected";
    if (isHigh) return "Elevated Blood Sugar";
    if (isInRange) return "Blood Sugar In Range";
    if (isStale) return "Glucose Reading Stale";
    return "Glucose Guard";
  };

  return (
    <div className={`rounded-lg border p-4 ${getBannerStyles()} ${className}`}>
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-full ${getIconBgStyles()}`}>
          {getIcon()}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h4 className={`font-semibold ${getTitleStyles()}`}>
              {getTitle()}
            </h4>
            {onDismiss && (
              <button 
                onClick={onDismiss}
                className="text-white/50 hover:text-white/80 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          
          <p className="text-white/80 text-sm">
            {getGuidanceMessage(state, bgl)}
          </p>
        </div>
      </div>
    </div>
  );
}

export default GlucoseGuardBanner;
