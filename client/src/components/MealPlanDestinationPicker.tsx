import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { getActiveBuilderNs } from "@/lib/activeBuilderNs";
import { formatDateDisplay, getTodayISOSafe, getWeekStartFromDate } from "@/utils/midnight";
import { getRolling14Days } from "@/utils/dateRange";

const TZ = "America/Chicago";

export type MealPlanSlot =
  | "breakfast"
  | "lunch"
  | "dinner"
  | "meal4"
  | "meal5"
  | "meal6"
  | "snacks";

export interface MealPlanDestination {
  dateISO: string;
  slot: MealPlanSlot;
  builderType: string;
}

const SLOT_OPTIONS: Array<{ value: MealPlanSlot; label: string; emoji: string }> = [
  { value: "breakfast", label: "Meal 1", emoji: "1️⃣" },
  { value: "lunch", label: "Meal 2", emoji: "2️⃣" },
  { value: "dinner", label: "Meal 3", emoji: "3️⃣" },
  { value: "meal4", label: "Meal 4", emoji: "4️⃣" },
  { value: "meal5", label: "Meal 5", emoji: "5️⃣" },
  { value: "meal6", label: "Meal 6", emoji: "6️⃣" },
  { value: "snacks", label: "Snack", emoji: "🍎" },
];

interface MealPlanDestinationPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  busy?: boolean;
  busyLabel?: string;
  busyContent?: ReactNode;
  onSelect: (destination: MealPlanDestination) => void | Promise<void>;
}

export function MealPlanDestinationPicker({
  open,
  onOpenChange,
  title,
  busy = false,
  busyLabel = "Creating your meal…",
  busyContent,
  onSelect,
}: MealPlanDestinationPickerProps) {
  const todayISO = getTodayISOSafe(TZ);
  const dates = getRolling14Days(todayISO);
  const [selectedDate, setSelectedDate] = useState(todayISO);
  const [selectedSlot, setSelectedSlot] = useState<MealPlanSlot | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [boardDays, setBoardDays] = useState<Record<string, any> | null>(null);
  const [boardLoading, setBoardLoading] = useState(false);
  const [boardError, setBoardError] = useState<string | null>(null);
  const cache = useRef<Record<string, Record<string, any> | null>>({});
  const requestSequence = useRef(0);

  const fetchWeek = useCallback(async (dateISO: string) => {
    const weekStart = getWeekStartFromDate(dateISO, TZ);
    if (cache.current[weekStart] !== undefined) {
      setBoardDays(cache.current[weekStart]);
      return;
    }
    const sequence = ++requestSequence.current;
    setBoardLoading(true);
    setBoardError(null);
    try {
      const builderType = getActiveBuilderNs();
      const bt = builderType ? `&bt=${encodeURIComponent(builderType)}` : "";
      const response = await fetch(
        apiUrl(`/api/weekly-board?week=${encodeURIComponent(weekStart)}${bt}`),
        { credentials: "include", headers: getAuthHeaders() },
      );
      if (!response.ok) throw new Error("We couldn't check your current meal plan.");
      const payload = await response.json();
      const days = payload?.week?.days ?? null;
      cache.current[weekStart] = days;
      if (sequence === requestSequence.current) setBoardDays(days);
    } catch (error) {
      if (sequence === requestSequence.current) {
        setBoardDays(null);
        setBoardError(error instanceof Error ? error.message : "We couldn't check your current meal plan.");
      }
    } finally {
      if (sequence === requestSequence.current) setBoardLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setSelectedDate(todayISO);
    setSelectedSlot(null);
    setConfirming(false);
    fetchWeek(todayISO);
  }, [open, todayISO, fetchWeek]);

  useEffect(() => {
    if (open) fetchWeek(selectedDate);
  }, [open, selectedDate, fetchWeek]);

  const existingMeal = selectedSlot ? boardDays?.[selectedDate]?.[selectedSlot]?.[0] : null;

  const selectSlot = (slot: MealPlanSlot) => {
    if (busy || boardLoading || boardError) return;
    setSelectedSlot(slot);
    const occupied = slot !== "snacks" && (boardDays?.[selectedDate]?.[slot]?.length ?? 0) > 0;
    if (occupied) {
      setConfirming(true);
      return;
    }
    onSelect({ dateISO: selectedDate, slot, builderType: getActiveBuilderNs() || "" });
  };

  return (
    <Drawer open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DrawerContent className="border-t border-white/20 bg-black/95">
        {busy && busyContent ? (
          <div className="px-5 pb-10 pt-6">
            <DrawerHeader className="pb-2 text-center">
              <DrawerTitle className="text-lg text-white">Preparing Your Meal</DrawerTitle>
              <p className="mt-1 truncate px-4 text-sm text-white/60">{title}</p>
            </DrawerHeader>
            {busyContent}
          </div>
        ) : confirming ? (
          <div className="p-6 pb-10">
            <button type="button" onClick={() => setConfirming(false)} className="mb-5 flex items-center gap-1 text-sm text-white/50">
              <ChevronLeft className="h-4 w-4" /> Back
            </button>
            <p className="text-center text-base font-semibold text-white">Replace existing meal?</p>
            <p className="mb-6 mt-1 px-4 text-center text-sm text-white/50">
              “{existingMeal?.title || existingMeal?.name || "This meal"}” is already in this slot.
            </p>
            <Button
              className="mb-3 h-14 w-full rounded-full bg-violet-600 text-base font-semibold text-white hover:bg-violet-500"
              disabled={busy || !selectedSlot}
              onClick={() => selectedSlot && onSelect({
                dateISO: selectedDate,
                slot: selectedSlot,
                builderType: getActiveBuilderNs() || "",
              })}
            >
              {busy ? busyLabel : "Replace and Create"}
            </Button>
            <Button variant="ghost" className="h-12 w-full text-base text-white/60" disabled={busy} onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <>
            <DrawerHeader className="pb-0 text-center">
              <DrawerTitle className="text-lg text-white">Add to Plan</DrawerTitle>
              <p className="mt-1 truncate px-4 text-sm text-white/60">{title}</p>
            </DrawerHeader>
            <div className="px-4 pb-2 pt-4">
              <p className="mb-2 text-xs uppercase tracking-widest text-white/40">Day</p>
              <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
                {dates.map((dateISO) => {
                  const active = selectedDate === dateISO;
                  const isToday = dateISO === todayISO;
                  return (
                    <button
                      type="button"
                      key={dateISO}
                      disabled={busy}
                      onClick={() => { setSelectedDate(dateISO); setSelectedSlot(null); }}
                      className={`flex h-14 w-12 flex-shrink-0 flex-col items-center justify-center rounded-xl border transition-all ${
                        active ? "border-violet-600 bg-violet-600 text-white" : "border-white/15 bg-white/5 text-white/70"
                      }`}
                    >
                      <span className={`text-[10px] font-medium ${active ? "text-white/80" : "text-white/40"}`}>
                        {isToday ? "Today" : formatDateDisplay(dateISO, { weekday: "short" }, TZ)}
                      </span>
                      <span className="text-base font-bold leading-tight">{formatDateDisplay(dateISO, { day: "numeric" }, TZ)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="px-4 pb-8 pt-3">
              <p className="mb-2 text-xs uppercase tracking-widest text-white/40">Meal</p>
              {boardError && (
                <div className="mb-3 rounded-xl border border-red-300/25 bg-red-950/40 p-3 text-sm text-red-100">
                  <p>{boardError}</p>
                  <button type="button" onClick={() => fetchWeek(selectedDate)} className="mt-2 font-semibold text-violet-200 underline">
                    Try again
                  </button>
                </div>
              )}
              <div className="space-y-2">
                {SLOT_OPTIONS.map((option) => {
                  const existing = boardDays?.[selectedDate]?.[option.value]?.[0];
                  const occupied = option.value !== "snacks" && Boolean(existing);
                  return (
                    <button
                      type="button"
                      key={option.value}
                      disabled={busy || boardLoading || Boolean(boardError)}
                      onClick={() => selectSlot(option.value)}
                      className="flex w-full items-center gap-3 rounded-xl border border-white/15 bg-white/5 px-4 py-3 transition-all hover:bg-white/10 disabled:opacity-60"
                    >
                      <span className="text-2xl">{option.emoji}</span>
                      <div className="min-w-0 flex-1 text-left">
                        <p className="text-sm font-medium text-white">{option.label}</p>
                        {occupied && <p className="truncate text-xs text-white/40">{existing?.title || existing?.name}</p>}
                      </div>
                      <span className={`text-xs font-medium ${occupied ? "text-amber-400/80" : "text-violet-300"}`}>
                        {busy && selectedSlot === option.value ? busyLabel : occupied ? "Replace" : "Open"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}