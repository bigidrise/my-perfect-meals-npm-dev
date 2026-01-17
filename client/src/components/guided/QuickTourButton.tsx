import { PillButton } from "@/components/ui/pill-button";

interface QuickTourButtonProps {
  onClick: () => void;
  className?: string;
  asPillButton?: boolean;
}

export function QuickTourButton({ onClick, className = "", asPillButton = false }: QuickTourButtonProps) {
  if (asPillButton) {
    return (
      <PillButton
        onClick={onClick}
        className={className}
        aria-label="How to use this page"
      >
        Guide
      </PillButton>
    );
  }

  return (
    <PillButton
      onClick={onClick}
      className={className}
      aria-label="How to use this page"
    >
      Guide
    </PillButton>
  );
}
