import { Minus } from "lucide-react";
import { PillButton } from "@/components/ui/pill-button";
import { useConsumerCopy } from "@/i18n/useConsumerCopy";

interface KeepItSimpleToggleProps {
  keepItSimple: boolean;
  onToggle: (value: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export function KeepItSimpleToggle({
  keepItSimple,
  onToggle,
  disabled = false,
  className = "",
}: KeepItSimpleToggleProps) {
  const { t } = useConsumerCopy();
  const handleClick = () => {
    if (disabled) return;
    onToggle(!keepItSimple);
  };

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <Minus className="w-3.5 h-3.5 text-sky-400" />
          <span className="text-xs text-white/70 font-medium">
            {t("Keep It Simple")} <span className="text-white/50">—</span>{" "}
            <span className="text-sky-400/80">{t("Ingredient Control")}</span>
          </span>
        </div>

        <PillButton
          disabled={disabled}
          onClick={handleClick}
          active={keepItSimple}
          aria-label={keepItSimple ? t("Keep It Simple On - Click to disable") : t("Keep It Simple Off - Click to enable")}
        >
          {keepItSimple ? t("On") : t("Off")}
        </PillButton>
      </div>

      <p className={`text-xs pl-5 font-medium ${keepItSimple ? "text-sky-300" : "text-white/60"}`}>
        {keepItSimple
          ? t("AI will use only what you listed — no extra ingredients added")
          : t("AI may add vegetables, sides, or balancing ingredients")}
      </p>
    </div>
  );
}
