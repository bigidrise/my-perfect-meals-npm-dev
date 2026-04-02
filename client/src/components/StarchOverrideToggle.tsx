import { Wheat } from "lucide-react";
import { PillButton } from "@/components/ui/pill-button";

interface StarchOverrideToggleProps {
  active: boolean;
  onToggle: (active: boolean) => void;
  disabled?: boolean;
}

export function StarchOverrideToggle({
  active,
  onToggle,
  disabled = false,
}: StarchOverrideToggleProps) {
  const handleClick = () => {
    if (disabled) return;
    onToggle(!active);
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <Wheat className="w-3.5 h-3.5 text-orange-400" />
          <span className="text-xs text-white/70 font-medium">
            Starch Plan{" "}
            <span className="text-white/50">—</span>{" "}
            <span className={active ? "text-orange-400" : "text-white/50"}>
              {active ? "Override On" : "Following Plan"}
            </span>
          </span>
        </div>

        <PillButton
          disabled={disabled}
          onClick={handleClick}
          active={active}
          variant="amber"
          aria-label={
            active
              ? "Starch override active — click to follow plan"
              : "Allow starch for this meal"
          }
        >
          {active ? "Override" : "Allow Starch"}
        </PillButton>
      </div>

      {active && (
        <p className="text-[10px] text-orange-300/70 mt-0.5 ml-5">
          Starch allowed for this meal only — resets after generation
        </p>
      )}
    </div>
  );
}

export default StarchOverrideToggle;
