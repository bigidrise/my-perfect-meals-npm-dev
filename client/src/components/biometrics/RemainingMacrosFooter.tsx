import { useMemo, useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { resolveDisplayCarbTargets } from "@/lib/macroResolver";
import { useTodayMacros } from "@/hooks/useTodayMacros";
import {
  MPM_GLASS,
  MPM_STICKY_FOOTER,
  MPM_MACRO_COLORS,
  getMacroProgressColor,
} from "@/components/glass/mpmGlassStandard";
import { Flame, RefreshCw, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { PillButton } from "@/components/ui/pill-button";

export interface ConsumedMacros {
  protein: number;
  carbs: number;
  fat: number;
  starchyCarbs?: number;
  fibrousCarbs?: number;
}

export interface MacroTargets {
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  starchyCarbs_g?: number;
  fibrousCarbs_g?: number;
}

interface RemainingMacrosFooterProps {
  userId?: string;
  onSaveDay?: () => void;
  showSaveButton?: boolean;
  className?: string;
  consumedOverride?: ConsumedMacros;
  targetsOverride?: MacroTargets;
  layoutMode?: "sticky" | "inline";
  /** When true, shows an inline note that targets were updated mid-day */
  prescriptionChangedMidDay?: boolean;
  /** Short label for what caused the change, e.g. "ProCare override" */
  prescriptionChangeReason?: string;
}

export function RemainingMacrosFooter({
  userId,
  onSaveDay,
  showSaveButton = false,
  className = "",
  consumedOverride,
  targetsOverride,
  layoutMode = "sticky",
  prescriptionChangedMidDay,
  prescriptionChangeReason,
}: RemainingMacrosFooterProps) {
  const { user } = useAuth();
  const effectiveUserId = userId ?? user?.id ?? "";
  const todayMacros = useTodayMacros(effectiveUserId);

  // Re-compute targets whenever proStore/localStorage gets updated by the sync hook
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const handleUpdate = () => setTick(t => t + 1);
    window.addEventListener("mpm:targetsUpdated", handleUpdate);
    return () => window.removeEventListener("mpm:targetsUpdated", handleUpdate);
  }, []);

  // Dismiss state for the mid-day prescription changed banner
  const todayKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const storageKey = `mpm:prescriptionBannerDismissed:${todayKey}`;
  const [bannerDismissed, setBannerDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  });
  const dismissBanner = useCallback(() => {
    try {
      sessionStorage.setItem(storageKey, "1");
    } catch {
      // sessionStorage unavailable — suppress silently
    }
    setBannerDismissed(true);
  }, [storageKey]);

  // Presentation component — never resolves nutrition internally.
  // The parent workflow page must supply targetsOverride with pre-resolved targets.
  // When no targets are provided the component renders a "Set your macros" prompt.
  const targets = useMemo(() => {
    if (!targetsOverride) return { protein_g: 0, carbs_g: 0, fat_g: 0, starchyCarbs_g: 0, fibrousCarbs_g: 0 };
    const { starchyCarbs_g, fibrousCarbs_g } = resolveDisplayCarbTargets(targetsOverride);
    return { ...targetsOverride, starchyCarbs_g, fibrousCarbs_g };
  }, [targetsOverride, tick]);

  const hasTargets = targets.protein_g > 0 || targets.carbs_g > 0 || targets.fat_g > 0;

  const consumed = useMemo(() => {
    if (consumedOverride) {
      return {
        ...consumedOverride,
        starchyCarbs: consumedOverride.starchyCarbs ?? 0,
        fibrousCarbs: consumedOverride.fibrousCarbs ?? 0,
      };
    }
    return {
      protein: todayMacros.protein,
      carbs: todayMacros.starchyCarbs + todayMacros.fibrousCarbs,
      fat: todayMacros.fat,
      starchyCarbs: todayMacros.starchyCarbs ?? 0,
      fibrousCarbs: todayMacros.fibrousCarbs ?? 0,
    };
  }, [consumedOverride, todayMacros]);

  const remaining = useMemo(() => ({
    protein: Math.max(0, targets.protein_g - consumed.protein),
    carbs: Math.max(0, targets.carbs_g - consumed.carbs),
    fat: Math.max(0, targets.fat_g - consumed.fat),
    starchyCarbs: Math.max(0, (targets.starchyCarbs_g ?? 0) - consumed.starchyCarbs),
    fibrousCarbs: Math.max(0, (targets.fibrousCarbs_g ?? 0) - consumed.fibrousCarbs),
  }), [targets, consumed]);

  const colorState = useMemo(() => ({
    protein: getMacroProgressColor(consumed.protein, targets.protein_g),
    carbs: getMacroProgressColor(consumed.carbs, targets.carbs_g),
    fat: getMacroProgressColor(consumed.fat, targets.fat_g),
    starchyCarbs: getMacroProgressColor(consumed.starchyCarbs, targets.starchyCarbs_g ?? 0),
    fibrousCarbs: getMacroProgressColor(consumed.fibrousCarbs, targets.fibrousCarbs_g ?? 0),
  }), [consumed, targets]);

  const isInline = layoutMode === "inline";
  const containerClass = isInline 
    ? `w-full ${className}`
    : `${MPM_STICKY_FOOTER.container} ${className}`;
  const innerClass = isInline
    ? `${MPM_GLASS.medium} rounded-2xl p-4`
    : `${MPM_GLASS.medium} border-t border-white/10 ${MPM_STICKY_FOOTER.safeArea}`;
  const contentClass = isInline
    ? ""
    : MPM_STICKY_FOOTER.content;

  if (!hasTargets) {
    return (
      <div className={containerClass}>
        <div className={`${innerClass} px-4 py-3`}>
          <div className="flex items-center justify-center gap-2 text-white/60 text-sm">
            <Flame className="w-4 h-4" />
            <span>Set your macros in the Macro Calculator to see remaining</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={containerClass}>
      <div className={innerClass}>
        <div className={contentClass}>
          {showSaveButton && onSaveDay && (
            <button
              onClick={() => {
                sessionStorage.setItem("biometrics:returnTo", window.location.pathname + window.location.search);
                sessionStorage.setItem("biometrics:showGuide", "1");
                onSaveDay();
              }}
              className="w-full mb-3 py-2.5 bg-gradient-to-r from-zinc-900 to-zinc-900 hover:from-zinc-900 hover:to-zinc-900 text-white text-sm font-semibold rounded-xl transition-all active:scale-[0.98] shadow-lg border-2 border-zinc-700/90"
            >
              Save Day to Biometrics
            </button>
          )}

          {prescriptionChangedMidDay && !bannerDismissed && (
            <div className="flex items-center gap-1.5 mb-2 px-1 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <RefreshCw className="w-3 h-3 text-amber-400 shrink-0" />
              <span className="text-amber-300 text-xs flex-1">
                {prescriptionChangeReason
                  ? `Your targets were updated today (${prescriptionChangeReason})`
                  : "Your nutrition targets were updated today"}
              </span>
              <button
                onClick={dismissBanner}
                aria-label="Dismiss"
                className="text-amber-400/60 hover:text-amber-300 transition-colors p-0.5 shrink-0"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          <div className="flex items-center justify-center mb-2 gap-1.5">
            <span className="text-white/70 text-xs font-medium uppercase tracking-wide">
              Remaining Today
            </span>
            <MacroCoachSheet />
          </div>

          {/* 4-column layout: Protein, Starchy, Fibrous, Fat - NO CALORIES per product doctrine */}
          <div className="grid gap-2 grid-cols-4">
            <MacroCell
              label="Protein"
              remaining={remaining.protein}
              target={targets.protein_g}
              consumed={consumed.protein}
              colorState={colorState.protein}
              suffix="g"
            />
            <MacroCell
              label="Starchy"
              remaining={remaining.starchyCarbs}
              target={targets.starchyCarbs_g ?? 0}
              consumed={consumed.starchyCarbs}
              colorState={colorState.starchyCarbs}
              suffix="g"
              isKeyMacro
            />
            <MacroCell
              label="Fibrous"
              remaining={remaining.fibrousCarbs}
              target={targets.fibrousCarbs_g ?? 0}
              consumed={consumed.fibrousCarbs}
              colorState={colorState.fibrousCarbs}
              suffix="g"
            />
            <MacroCell
              label="Fat"
              remaining={remaining.fat}
              target={targets.fat_g}
              consumed={consumed.fat}
              colorState={colorState.fat}
              suffix="g"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

interface MacroCellProps {
  label: string;
  remaining: number;
  target: number;
  consumed: number;
  colorState: keyof typeof MPM_MACRO_COLORS;
  suffix?: string;
  isKeyMacro?: boolean;
}

function MacroCell({
  label,
  remaining,
  target,
  consumed,
  colorState,
  suffix = "",
  isKeyMacro = false,
}: MacroCellProps) {
  const color = MPM_MACRO_COLORS[colorState];
  const isOver = consumed > target && target > 0;
  const percentage = target > 0 ? Math.min(100, (consumed / target) * 100) : 0;

  return (
    <div className={`flex flex-col items-center rounded-lg px-1.5 py-1.5 ${
      isKeyMacro
        ? isOver
          ? "bg-red-950/40 border border-red-500/50"
          : "bg-amber-950/30 border border-amber-500/30"
        : "bg-black/20"
    }`}>
      <div className={`text-[10px] uppercase tracking-wide mb-0.5 ${isKeyMacro ? "text-amber-400 font-bold" : "text-white/50"}`}>
        {label}
      </div>
      <div className={`text-base font-bold ${isOver ? color.text : "text-white"}`}>
        {isOver ? `+${Math.round(consumed - target)}` : Math.round(remaining)}
        <span className="text-[10px] font-normal text-white/60">{suffix}</span>
      </div>
      <div className="w-full h-1 bg-black/30 rounded-full overflow-hidden mt-1">
        <div
          className={`h-full ${color.bg} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {isKeyMacro && (
        <div className={`text-[9px] font-bold uppercase tracking-wider mt-1 ${isOver ? "text-red-400" : "text-amber-500/80"}`}>
          {isOver ? "⚠ over limit" : "★ limit"}
        </div>
      )}
    </div>
  );
}

function MacroCoachSheet() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <PillButton aria-label="What do these numbers mean?">Info</PillButton>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="bg-zinc-950 border-t border-white/10 text-white max-h-[80vh] overflow-y-auto rounded-t-3xl px-6 pb-10"
      >
        <SheetHeader className="text-left pt-6 pb-5 border-b border-white/10">
          <SheetTitle className="text-white text-lg font-bold">
            Your Daily Targets, Simplified
          </SheetTitle>
          <p className="text-white/60 text-sm leading-relaxed mt-1">
            Remaining Today shows what you have left to hit your daily targets — by nutrient, not just total carbs.
          </p>
        </SheetHeader>

        <div className="pt-5 space-y-5">
          <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">🟡</span>
              <span className="text-amber-400 font-semibold text-sm">Starchy Carbs — Your Main Target</span>
            </div>
            <ul className="text-white/75 text-sm space-y-1 leading-relaxed pl-1">
              <li>Stay at or under your daily cap.</li>
              <li>Going over slows your progress — this one matters.</li>
              <li>Being under is completely fine. Don't force it.</li>
            </ul>
          </div>

          <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">🟢</span>
              <span className="text-emerald-400 font-semibold text-sm">Protein & Fiber — Stay Flexible</span>
            </div>
            <ul className="text-white/75 text-sm space-y-1 leading-relaxed pl-1">
              <li>A little high or low doesn't break anything.</li>
              <li>Don't chase perfection on these two.</li>
            </ul>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">⚪</span>
              <span className="text-white/80 font-semibold text-sm">Fat — Background Player</span>
            </div>
            <ul className="text-white/75 text-sm space-y-1 leading-relaxed pl-1">
              <li>Fat rises naturally with your food choices.</li>
              <li>Dietary fat is not the driver of fat gain — don't fixate on it.</li>
            </ul>
          </div>

          <div className="bg-zinc-900 rounded-2xl p-4 text-center space-y-2">
            <p className="text-white/90 text-sm font-medium leading-relaxed">
              Focus on staying within your starch target and let the rest fall into place.
            </p>
            <p className="text-white/40 text-xs">
              You don't need to be perfect. You need to be consistent.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
