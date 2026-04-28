import { CREATOR_DIET_OPTIONS } from "@/utils/getEffectiveDietPreference";
import { PillButton } from "@/components/ui/pill-button";
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
 * Pill-button pair + conditional diet selector for creator features.
 * Default: "My Diet" active → uses onboarding diet.
 * "Cook Different" active: reveals diet selector for situational cooking.
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
      <div className="flex items-center gap-2">
        <PillButton
          active={!overrideEnabled}
          variant="emerald"
          onClick={() => onToggle(false)}
        >
          My Diet
        </PillButton>
        <PillButton
          active={overrideEnabled}
          variant="amber"
          onClick={() => onToggle(true)}
        >
          Cook Different
        </PillButton>
      </div>

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
