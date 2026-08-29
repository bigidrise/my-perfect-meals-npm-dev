import { ArrowLeft } from "lucide-react";

interface AcademyBackButtonProps {
  onClick: () => void;
  label?: string;
  className?: string;
  "data-testid"?: string;
}

/**
 * Shared top-level navigation control for Academy and certification pages.
 * Keep this inline with the Business Suite's dark, compact navigation style.
 */
export function AcademyBackButton({
  onClick,
  label = "Back",
  className = "",
  "data-testid": dataTestId,
}: AcademyBackButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={dataTestId}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white bg-black/60 hover:bg-black/80 border border-white/20 backdrop-blur-sm transition-colors shadow-lg active:scale-[0.98] ${className}`}
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </button>
  );
}