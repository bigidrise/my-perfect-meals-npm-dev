import { CREATOR_CUISINE_OPTIONS } from "@/utils/getEffectiveDietPreference";
import { PillButton } from "@/components/ui/pill-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CuisineOverrideControlProps {
  savedCuisine?: string | null;
  overrideEnabled: boolean;
  overrideCuisine: string;
  onToggle: (enabled: boolean) => void;
  onCuisineChange: (cuisine: string) => void;
  className?: string;
}

/**
 * CuisineOverrideControl
 *
 * Pill-button pair + conditional cuisine selector for creator features.
 * Default: "My Cuisine" active → uses onboarding cuisine.
 * "Different Cuisine" active: reveals cuisine selector for this generation only.
 *
 * No global state. No localStorage. Component state only.
 */
export function CuisineOverrideControl({
  overrideEnabled,
  overrideCuisine,
  onToggle,
  onCuisineChange,
  className = "",
}: CuisineOverrideControlProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center gap-2">
        <PillButton
          active={!overrideEnabled}
          variant="emerald"
          onClick={() => onToggle(false)}
        >
          My Cuisine
        </PillButton>
        <PillButton
          active={overrideEnabled}
          variant="amber"
          onClick={() => onToggle(true)}
        >
          Different Cuisine
        </PillButton>
      </div>

      {overrideEnabled && (
        <Select value={overrideCuisine || "__none__"} onValueChange={(v) => onCuisineChange(v === "__none__" ? "" : v)}>
          <SelectTrigger className="bg-white/5 border-white/10 text-white rounded-xl">
            <SelectValue placeholder="Select cuisine style" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">No specific preference</SelectItem>
            {CREATOR_CUISINE_OPTIONS.map((opt) => (
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
