import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";

interface OnboardingFooterProps {
  isSaving: boolean;
  onSave: () => void;
  onBack?: () => void;
  disableNext?: boolean;
  nextLabel?: string;
  backLabel?: string;
  showBack?: boolean;
}

export function OnboardingFooter({
  isSaving,
  onSave,
  onBack,
  disableNext = false,
  nextLabel = "Save & Continue",
  backLabel = "Back",
  showBack = true
}: OnboardingFooterProps) {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-6 border-t">
      {showBack && onBack ? (
        <Button
          variant="outline"
          onClick={onBack}
          disabled={isSaving}
          className="flex items-center gap-2 w-full sm:w-auto"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Button>
      ) : (
        <div /> // Spacer for alignment
      )}

      <Button
        onClick={onSave}
        disabled={disableNext || isSaving}
        className="flex items-center gap-2 w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white"
      >
        {isSaving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            {nextLabel}
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>
    </div>
  );
}