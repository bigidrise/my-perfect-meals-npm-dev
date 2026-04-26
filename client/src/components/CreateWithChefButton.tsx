import { ChefHat } from "lucide-react";
import { PillButton } from "@/components/ui/pill-button";

interface CreateWithChefButtonProps {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

export function CreateWithChefButton({ onClick, disabled, className }: CreateWithChefButtonProps) {
  return (
    <div className={`inline-flex flex-col items-center gap-1 ${className || ""}`}>
      <PillButton onClick={onClick} disabled={disabled} className="px-3 border-amber-400/70">
        <ChefHat className="h-3 w-3" />
      </PillButton>
      <span className="text-xs font-semibold text-white/70 tracking-wide">Create with Chef</span>
    </div>
  );
}
