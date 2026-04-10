import { Minus } from "lucide-react";
import { PillButton } from "@/components/ui/pill-button";

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
  const handleClick = () => {
    if (disabled) return;
    onToggle(!keepItSimple);
  };

  return (
    <PillButton
      onClick={handleClick}
      disabled={disabled}
      variant="ghost"
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${
        keepItSimple
          ? "border-sky-500/40 bg-sky-500/10 text-sky-400"
          : "border-white/20 bg-white/5 text-white/70"
      } transition-all ${className}`}
    >
      <Minus className="w-4 h-4" />
      <span className="text-xs font-medium">
        {keepItSimple ? "Keep It Simple: ON" : "Keep It Simple"}
      </span>
    </PillButton>
  );
}
