import { Utensils } from "lucide-react";
import { PillButton } from "@/components/ui/pill-button";

interface FlavorToggleProps {
  flavorPersonal: boolean;
  onFlavorChange: (personal: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export function FlavorToggle({
  flavorPersonal,
  onFlavorChange,
  disabled = false,
  className = "",
}: FlavorToggleProps) {
  const handleClick = () => {
    if (disabled) return;
    onFlavorChange(!flavorPersonal);
  };

  return (
    <PillButton
      onClick={handleClick}
      disabled={disabled}
      variant="ghost"
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${
        flavorPersonal 
          ? "border-amber-500/40 bg-amber-500/10 text-amber-400" 
          : "border-white/20 bg-white/5 text-white/70"
      } transition-all ${className}`}
    >
      <Utensils className="w-4 h-4" />
      <span className="text-xs font-medium">
        Flavor: {flavorPersonal ? "Personal" : "Neutral"}
      </span>
    </PillButton>
  );
}
