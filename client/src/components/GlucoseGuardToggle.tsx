import { Activity } from "lucide-react";
import { useLocation } from "wouter";
import { PillButton } from "@/components/ui/pill-button";
import { useAuth } from "@/contexts/AuthContext";
import { useGlucoseLogs } from "@/hooks/useDiabetes";

export type GlucoseState = 
  | "low"
  | "low-normal"
  | "in-range"
  | "elevated"
  | "high-risk"
  | "stale"
  | "none";

interface GlucoseGuardToggleProps {
  onStateChange?: (state: GlucoseState, bgl: number | null) => void;
  disabled?: boolean;
  className?: string;
}

function classifyGlucose(valueMgdl: number, ageMinutes: number): GlucoseState {
  if (ageMinutes > 240) return "stale";
  if (valueMgdl < 70) return "low";
  if (valueMgdl <= 80) return "low-normal";
  if (valueMgdl <= 140) return "in-range";
  if (valueMgdl <= 180) return "elevated";
  return "high-risk";
}

function getStateLabel(state: GlucoseState): string {
  switch (state) {
    case "low": return "Low";
    case "low-normal": return "Low-Normal";
    case "in-range": return "In Range";
    case "elevated": return "Elevated";
    case "high-risk": return "High";
    case "stale": return "Stale";
    case "none": return "No Reading";
  }
}

function getStateColor(state: GlucoseState): string {
  switch (state) {
    case "low": return "text-rose-400";
    case "low-normal": return "text-teal-400";
    case "in-range": return "text-teal-400";
    case "elevated": return "text-amber-400";
    case "high-risk": return "text-amber-400";
    case "stale": return "text-white/50";
    case "none": return "text-white/50";
  }
}

export function GlucoseGuardToggle({
  onStateChange,
  disabled = false,
  className = "",
}: GlucoseGuardToggleProps) {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const userId = user?.id?.toString();
  
  const { data: glucoseLogs } = useGlucoseLogs(userId, 1);
  
  const latestLog = glucoseLogs?.data?.[0];
  
  let state: GlucoseState = "none";
  let bgl: number | null = null;
  let ageMinutes = 0;
  
  if (latestLog && typeof latestLog.valueMgdl === "number") {
    const reading = latestLog.valueMgdl;
    bgl = reading;
    const recordedAt = new Date(latestLog.recordedAt);
    ageMinutes = Math.floor((Date.now() - recordedAt.getTime()) / (1000 * 60));
    state = classifyGlucose(reading, ageMinutes);
    onStateChange?.(state, reading);
  }
  
  const isActive = state !== "none" && state !== "stale";
  
  const handleClick = () => {
    if (disabled) return;
    setLocation("/diabetic-hub");
  };

  return (
    <div className={`relative ${className}`}>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs text-white/70 font-medium">
            Glucose Guard <span className="text-white/50">—</span>{" "}
            <span className={getStateColor(state)}>
              {bgl ? `${bgl} mg/dL` : "Log Reading"}
            </span>
          </span>
        </div>
        
        <PillButton
          disabled={disabled}
          onClick={handleClick}
          active={isActive}
          variant="amber"
          aria-label={isActive ? `Glucose Guard Active: ${getStateLabel(state)}` : "Log glucose reading"}
        >
          {isActive ? getStateLabel(state) : "Log"}
        </PillButton>
      </div>
      
      {isActive && ageMinutes > 0 && (
        <div className="text-[10px] text-white/40 mt-0.5 ml-5">
          Logged {ageMinutes < 60 ? `${ageMinutes}m` : `${Math.floor(ageMinutes / 60)}h ${ageMinutes % 60}m`} ago
        </div>
      )}
    </div>
  );
}

export default GlucoseGuardToggle;
