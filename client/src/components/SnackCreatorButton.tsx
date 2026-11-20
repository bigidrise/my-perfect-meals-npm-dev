import { ChefHat } from "lucide-react";
import { PillButton } from "@/components/ui/pill-button";
import { useConsumerCopy } from "@/i18n/useConsumerCopy";

interface SnackCreatorButtonProps {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

export function SnackCreatorButton({ onClick, disabled, className }: SnackCreatorButtonProps) {
  const { t } = useConsumerCopy();
  return (
    <div className={`inline-flex flex-col items-center gap-1 ${className || ""}`}>
      <PillButton onClick={onClick} disabled={disabled} active={true} variant="amber" className="px-3">
        <ChefHat className="h-3 w-3" />
      </PillButton>
      <span className="text-xs font-semibold text-white/70 tracking-wide">{t("Snack Creator")}</span>
    </div>
  );
}
