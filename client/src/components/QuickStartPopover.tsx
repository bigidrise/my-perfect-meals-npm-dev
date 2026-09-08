import { useState } from "react";
import { useLocation } from "wouter";
import { Sparkles } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/apiRequest";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { AcademyProgression } from "@shared/academyProgression";

const DISMISSED_PREFERENCE = "quickStartHeaderDismissed";

type AppPreferences = Record<string, unknown>;

interface QuickStartPopoverProps {
  compact?: boolean;
}

export function QuickStartPopover({ compact = false }: QuickStartPopoverProps) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);

  const { data: preferences, isLoading: preferencesLoading } = useQuery<AppPreferences>({
    queryKey: ["/api/users", user?.id, "app-preferences"],
    queryFn: () => apiRequest(`/api/users/${user!.id}/app-preferences`),
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const { data: progression, isLoading: progressionLoading } = useQuery<AcademyProgression>({
    queryKey: ["/api/certifications/academy-progression", user?.id],
    queryFn: () => apiRequest("/api/certifications/academy-progression"),
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  if (
    !user?.id ||
    preferencesLoading ||
    progressionLoading ||
    preferences?.[DISMISSED_PREFERENCE] === true ||
    progression?.phase1.complete === true
  ) {
    return null;
  }

  const dismissPermanently = async () => {
    setIsDismissing(true);
    try {
      await apiRequest(`/api/users/${user.id}/app-preferences`, {
        method: "PATCH",
        body: JSON.stringify({ [DISMISSED_PREFERENCE]: true }),
      });
      queryClient.setQueryData<AppPreferences>(
        ["/api/users", user.id, "app-preferences"],
        (current = {}) => ({ ...current, [DISMISSED_PREFERENCE]: true }),
      );
      setOpen(false);
    } finally {
      setIsDismissing(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={
            compact
              ? "flex items-center gap-1 text-[10px] font-semibold leading-none text-amber-300 hover:text-amber-200 transition-colors"
              : "flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-400/15 hover:text-amber-200 transition-colors"
          }
          aria-label="Open Quick Start"
          data-testid="button-quick-start"
        >
          <Sparkles className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
          <span>Quick Start</span>
          {!compact && (
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

          <div className="rounded-lg border border-amber-400/20 bg-amber-400/10 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-300">Highly recommended</p>
            <p className="mt-1 text-sm leading-relaxed text-white/80">
              Take a few minutes to explore the App Library and learn what your platform can do.
            </p>
          </div>

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

          <p className="text-center text-xs leading-relaxed text-white/50">
            Complete the App Library and Quick Start will automatically disappear.
          </p>

          <button
            type="button"
            onClick={dismissPermanently}
            disabled={isDismissing}
            className="w-full text-center text-xs font-medium text-white/60 underline-offset-4 transition-colors hover:text-white hover:underline disabled:cursor-wait disabled:opacity-50"
          >
            {isDismissing ? "Saving…" : "Don't show this again"}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}