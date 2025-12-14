import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, SkipForward } from "lucide-react";

interface WalkthroughControlsProps {
  canGoPrevious: boolean;
  canGoNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onSkip?: () => void;
}

/**
 * Manual navigation controls for walkthrough
 * Ensures users can always advance even if automation fails
 * Apple App Store Ready - Always accessible
 */
export function WalkthroughControls({
  canGoPrevious,
  canGoNext,
  onPrevious,
  onNext,
  onSkip,
}: WalkthroughControlsProps) {
  return (
    <div className="flex items-center justify-center gap-2 mt-4">
      <Button
        variant="outline"
        size="sm"
        onClick={onPrevious}
        disabled={!canGoPrevious}
        className="bg-black/40 backdrop-blur-sm border-white/20 text-white hover:bg-black/60"
      >
        <ChevronLeft className="w-4 h-4 mr-1" />
        Previous
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={onNext}
        disabled={!canGoNext}
        className="bg-black/40 backdrop-blur-sm border-white/20 text-white hover:bg-black/60"
      >
        Next
        <ChevronRight className="w-4 h-4 ml-1" />
      </Button>

      {onSkip && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onSkip}
          className="bg-black/40 backdrop-blur-sm border-white/20 text-white/70 hover:bg-black/60 hover:text-white"
        >
          <SkipForward className="w-4 h-4 mr-1" />
          Skip
        </Button>
      )}
    </div>
  );
}
