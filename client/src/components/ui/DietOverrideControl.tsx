import { useConsumerCopy } from "@/i18n/useConsumerCopy";
import { useCreatorOptionLabels } from "@/i18n/useCreatorOptionLabels";
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
  dietOptions?: ReadonlyArray<{ value: string; label: string }>;
  className?: string;
}

/**
 * DietOverrideControl
 *
 * Pill-button pair + conditional diet selector for creator features.
 * Default: "My Diet" active → uses onboarding diet.
 * "Different Diet" active: reveals diet selector for situational cooking.
 *
 * No global state. No localStorage. Component state only.
 */
export function DietOverrideControl({
  overrideEnabled,
  overrideDiet,
  onToggle,
  onDietChange,
  dietOptions = CREATOR_DIET_OPTIONS,
  className = "",
}: DietOverrideControlProps) {
  const { t } = useConsumerCopy();
  const optionLabels = useCreatorOptionLabels();
  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center gap-2">
        <PillButton
          active={!overrideEnabled}
          variant="emerald"
          onClick={() => onToggle(false)}
        >
          {t("My Diet")}
        </PillButton>
        <PillButton
          active={overrideEnabled}
          variant="amber"
          onClick={() => onToggle(true)}
        >
          {t("Different Diet")}
        </PillButton>
      </div>

      {overrideEnabled && (
        <Select value={overrideDiet || "__none__"} onValueChange={(v) => onDietChange(v === "__none__" ? "" : v)}>
          <SelectTrigger className="bg-white/5 border-white/10 text-white rounded-xl">
            <SelectValue placeholder={t("Select dietary style")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">{t("No specific preference")}</SelectItem>
            {dietOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {optionLabels[opt.label] ?? opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
