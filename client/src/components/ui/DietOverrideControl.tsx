import { CREATOR_DIET_OPTIONS } from "@/utils/getEffectiveDietPreference";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DietOverrideControlProps {
  overrideEnabled: boolean;
  overrideDiet: string;
  onToggle: (enabled: boolean) => void;
  onDietChange: (diet: string) => void;
  className?: string;
}

/**
 * DietOverrideControl
 *
 * Toggle + conditional diet selector for creator features.
 * Default: "Use My Preferences" ON → uses onboarding diet.
 * When toggled OFF: reveals diet selector for situational cooking.
 *
 * No global state. No localStorage. Component state only.
 */
export function DietOverrideControl({
  overrideEnabled,
  overrideDiet,
  onToggle,
  onDietChange,
  className = "",
}: DietOverrideControlProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      <button
        type="button"
        onClick={() => onToggle(!overrideEnabled)}
        className="flex items-center justify-between w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/8 transition-colors"
      >
        <div className="flex flex-col items-start gap-0.5">
          <span className="text-sm font-medium text-white">
            {overrideEnabled ? "Cooking for someone else?" : "Using my dietary preferences"}
          </span>
          <span className="text-xs text-white/50">
            {overrideEnabled
              ? "Select a diet below to override your plan"
              : "Tap to cook for a different dietary style"}
          </span>
        </div>
        <div
          className={`relative w-10 h-5.5 rounded-full transition-colors flex-shrink-0 ${
            overrideEnabled ? "bg-orange-500" : "bg-white/20"
          }`}
          style={{ minWidth: 40, height: 22 }}
        >
          <div
            className={`absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white shadow transition-transform ${
              overrideEnabled ? "translate-x-5" : "translate-x-0.5"
            }`}
            style={{ width: 18, height: 18 }}
          />
        </div>
      </button>

      {overrideEnabled && (
        <Select value={overrideDiet || "__none__"} onValueChange={(v) => onDietChange(v === "__none__" ? "" : v)}>
          <SelectTrigger className="bg-white/5 border-white/10 text-white rounded-xl">
            <SelectValue placeholder="Select dietary style" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">No specific preference</SelectItem>
            {CREATOR_DIET_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
