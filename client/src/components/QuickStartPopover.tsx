import { useState } from "react";
import { useLocation } from "wouter";
import { Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/apiRequest";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { AcademyProgression } from "@shared/academyProgression";

interface QuickStartPopoverProps {
  compact?: boolean;
}

export function QuickStartPopover({ compact = false }: QuickStartPopoverProps) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);

  const { data: progression } = useQuery<AcademyProgression>({
    queryKey: ["/api/certifications/academy-progression", user?.id],
    queryFn: () => apiRequest("/api/certifications/academy-progression"),
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  if (!user?.id) return null;

  const hasCompletedPhaseOne = progression?.phase1.complete === true;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={
            compact
              ? `flex items-center gap-1 text-[10px] font-semibold leading-none transition-colors ${
                  hasCompletedPhaseOne
                    ? "text-white/60 hover:text-white"
                    : "text-amber-300 hover:text-amber-200"
                }`
              : `flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                  hasCompletedPhaseOne
                    ? "border-white/15 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                    : "border-amber-400/30 bg-amber-400/10 text-amber-300 hover:bg-amber-400/15 hover:text-amber-200"
                }`
          }
          aria-label="Open Quick Start"
          data-testid="button-quick-start"
        >
          <Sparkles className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
          <span>Quick Start</span>
          {!compact && !hasCompletedPhaseOne && (
            <span className="rounded-full bg-amber-300/15 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-amber-200">
              Recommended
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align={compact ? "center" : "end"}
        sideOffset={10}
        className="z-[80] w-[calc(100vw-2rem)] max-w-sm border-amber-400/25 bg-zinc-950 p-4 text-white shadow-2xl"
      >
        <div className="space-y-3">
          <div>
            <h2 className="text-base font-bold text-white">Get More From My Perfect Meals</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-white/70">
              My Perfect Meals is more than a meal app. It's a complete AI nutrition and coaching platform.
            </p>
          </div>

          {hasCompletedPhaseOne ? (
            <p className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm leading-relaxed text-white/75">
              Return to the App Library anytime for a refresher on the platform and its tools.
            </p>
          ) : (
            <div className="rounded-lg border border-amber-400/20 bg-amber-400/10 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-amber-300">Highly recommended</p>
              <p className="mt-1 text-sm leading-relaxed text-white/80">
                Take a few minutes to explore the App Library and learn what your platform can do.
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setLocation("/learn");
            }}
            className="w-full rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-500"
          >
            Open App Library
          </button>

          {!hasCompletedPhaseOne && (
            <p className="text-center text-xs leading-relaxed text-white/50">
              Complete Platform Mastery Phase 1 and Quick Start will shift to a quieter refresher.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}