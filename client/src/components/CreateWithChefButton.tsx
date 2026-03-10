import { ChefHat } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CreateWithChefButtonProps {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

export function CreateWithChefButton({ onClick, disabled, className }: CreateWithChefButtonProps) {
  return (
    <Button
      size="sm"
      variant="ghost"
      className={`text-white/80 hover:bg-black/50 border border-orange-400/40 text-xs font-medium flex items-center gap-1 flash-border ${className || ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      <ChefHat className="h-3 w-3" />
      Create With Chef
    </Button>
  );
}
