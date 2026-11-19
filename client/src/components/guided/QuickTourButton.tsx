import { PillButton } from "@/components/ui/pill-button";

interface QuickTourButtonProps {
  onClick: () => void;
  className?: string;
  asPillButton?: boolean;
  label?: string;
  ariaLabel?: string;
}

export function QuickTourButton({ onClick, className = "", asPillButton = false, label = "Guide", ariaLabel = "How to use this page" }: QuickTourButtonProps) {
  if (asPillButton) {
    return (
      <PillButton
        onClick={onClick}
        className={className}
        aria-label={ariaLabel}
      >
        {label}
      </PillButton>
    );
  }

  return (
    <PillButton
      onClick={onClick}
      className={className}
      aria-label={ariaLabel}
    >
      {label}
    </PillButton>
  );
}
