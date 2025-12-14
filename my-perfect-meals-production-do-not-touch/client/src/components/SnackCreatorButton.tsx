import { Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SnackCreatorButtonProps {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

export function SnackCreatorButton({ onClick, disabled, className }: SnackCreatorButtonProps) {
  return (
    <Button
      size="sm"
      variant="ghost"
      className={`text-white/80 hover:bg-black/50 border border-amber-400/40 text-xs font-medium flex items-center gap-1 flash-border ${className || ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      <Cookie className="h-3 w-3" />
      Snack Creator
    </Button>
  );
}
