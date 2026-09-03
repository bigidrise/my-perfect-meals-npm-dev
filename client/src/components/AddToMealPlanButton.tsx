import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { CalendarPlus, Lock, ChevronLeft } from "lucide-react";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { getActiveBuilderNs } from "@/lib/activeBuilderNs";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useFreeLock } from "@/hooks/useFreeLock";
import { UpgradeLockModal } from "@/components/upgrade/UpgradeLockModal";
import {
  getTodayISOSafe,
  getWeekStartFromDate,
  formatDateDisplay,
} from "@/utils/midnight";
import { getRolling14Days } from "@/utils/dateRange";

const TZ = "America/Chicago";

interface AddToMealPlanButtonProps {
  meal: any;
  onSuccess?: () => void;
}

type Slot = "breakfast" | "lunch" | "dinner" | "meal4" | "meal5" | "meal6" | "snacks";

const SLOT_OPTIONS: { value: Slot; label: string; emoji: string }[] = [
  { value: "breakfast", label: "Meal 1", emoji: "1️⃣" },
  { value: "lunch",     label: "Meal 2", emoji: "2️⃣" },
  { value: "dinner",    label: "Meal 3", emoji: "3️⃣" },
  { value: "meal4",     label: "Meal 4", emoji: "4️⃣" },
  { value: "meal5",     label: "Meal 5", emoji: "5️⃣" },
  { value: "meal6",     label: "Meal 6", emoji: "6️⃣" },
  { value: "snacks",    label: "Snack",  emoji: "🍎" },
];

function formatDayLabel(dateISO: string, todayISO: string): { short: string; dayNum: string; isToday: boolean } {
  return {
    short: formatDateDisplay(dateISO, { weekday: "short" }, TZ),
    dayNum: formatDateDisplay(dateISO, { day: "numeric" }, TZ),
    isToday: dateISO === todayISO,
  };
}

export default function AddToMealPlanButton({ meal, onSuccess }: AddToMealPlanButtonProps) {
  const todayISO = getTodayISOSafe(TZ);
  const rollingDates = getRolling14Days(todayISO);

  const [isOpen, setIsOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [occupiedMealTitle, setOccupiedMealTitle] = useState<string | null>(null);
  const [boardDays, setBoardDays] = useState<Record<string, any> | null>(null);
  const [boardLoading, setBoardLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(todayISO);

  const boardCache = useRef<Record<string, Record<string, any> | null>>({});

  const { isFree, showLockModal, lockMessage, guardAction, closeLockModal } = useFreeLock();

  if (!meal) return null;

  const fetchBoardForWeek = useCallback(async (weekStart: string): Promise<Record<string, any> | null> => {
    if (boardCache.current[weekStart] !== undefined) {
      return boardCache.current[weekStart];
    }
    setBoardLoading(true);
    try {
      const ns = getActiveBuilderNs();
      const btParam = ns ? `&bt=${encodeURIComponent(ns)}` : "";
      const res = await fetch(
        apiUrl(`/api/weekly-board?week=${encodeURIComponent(weekStart)}${btParam}`),
        { credentials: "include", headers: { ...getAuthHeaders() } }
      );
      if (!res.ok) return null;
      const json = await res.json();
      const days = json?.week?.days || null;
      boardCache.current[weekStart] = days;
      return days;
    } catch {
      return null;
    } finally {
      setBoardLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen || !selectedDate) return;
    const weekStart = getWeekStartFromDate(selectedDate, TZ);
    const cached = boardCache.current[weekStart];
    if (cached !== undefined) {
      setBoardDays(cached);
      return;
    }
    fetchBoardForWeek(weekStart).then((days) => {
      setBoardDays(days);
    });
  }, [selectedDate, isOpen, fetchBoardForWeek]);

  const handleOpenDrawer = (e: React.MouseEvent) => {
    e.stopPropagation();
    guardAction("Add meals to your weekly plan and track your nutrition with Essential.", () => {
      const today = getTodayISOSafe(TZ);
      setSelectedDate(today);
      setSelectedSlot(null);
      setConfirming(false);
      setOccupiedMealTitle(null);
      setIsOpen(true);
    });
  };

  const slotMeals = (dateISO: string, slot: Slot): any[] => {
    return boardDays?.[dateISO]?.[slot] || [];
  };

  const isOccupied = (dateISO: string, slot: Slot): boolean => {
    if (slot === "snacks") return false;
    return slotMeals(dateISO, slot).length > 0;
  };

  const occupiedTitle = (dateISO: string, slot: Slot): string | null => {
    const meals = slotMeals(dateISO, slot);
    if (!meals.length) return null;
    return meals[0]?.title || meals[0]?.name || "existing meal";
  };

  const handleSlotTap = (slot: Slot) => {
    if (isAdding) return;
    if (isOccupied(selectedDate, slot)) {
      setSelectedSlot(slot);
      setOccupiedMealTitle(occupiedTitle(selectedDate, slot));
      setConfirming(true);
    } else {
      doAdd(slot);
    }
  };

  const doAdd = async (slot: Slot) => {
    setSelectedSlot(slot);
    setIsAdding(true);
    setConfirming(false);

    try {
      const response = await fetch(apiUrl("/api/weekly-board/add-meal"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({
          dateISO: selectedDate,
          slot,
          bt: getActiveBuilderNs(),
          meal: {
            id: meal.id,
            name: meal.name || meal.title,
            title: meal.name || meal.title,
            description: meal.description,
            imageUrl: meal.imageUrl,
            ingredients: meal.ingredients,
            instructions: meal.instructions,
            calories: meal.calories || meal.nutrition?.calories,
            protein: meal.protein || meal.nutrition?.protein,
            carbs: meal.carbs || meal.nutrition?.carbs,
            fat: meal.fat || meal.nutrition?.fat,
            starchyCarbs: meal.starchyCarbs || meal.nutrition?.starchyCarbs,
            fibrousCarbs: meal.fibrousCarbs || meal.nutrition?.fibrousCarbs,
            cookingTime: meal.cookingTime,
            difficulty: meal.difficulty,
            medicalBadges: meal.medicalBadges || [],
            builderType: meal.builderType,
          },
        }),
      });

      if (!response.ok) throw new Error("Failed to add meal");

      const result = await response.json();

      window.dispatchEvent(new CustomEvent("mpm:board-slot-added", {
        detail: {
          weekStartISO: result.weekStartISO,
          dateISO: result.dateISO,
          slot: result.slot,
          updatedDay: result.updatedDay,
        },
      }));

      if (result.updatedDay) {
        setBoardDays((prev) => ({
          ...(prev || {}),
          [selectedDate]: result.updatedDay,
        }));
        const weekStart = getWeekStartFromDate(selectedDate, TZ);
        if (boardCache.current[weekStart]) {
          boardCache.current[weekStart] = {
            ...(boardCache.current[weekStart] || {}),
            [selectedDate]: result.updatedDay,
          };
        }
      }

      const slotLabel = SLOT_OPTIONS.find((s) => s.value === slot)?.label || slot;
      const { short, dayNum, isToday } = formatDayLabel(selectedDate, todayISO);
      const dayLabel = isToday ? "Today" : `${short} ${dayNum}`;

      window.dispatchEvent(new CustomEvent("show-toast", {
        detail: {
          title: result.wasOccupied ? "Meal Replaced!" : "Added to Meal Plan!",
          description: `${meal.name || meal.title} → ${dayLabel} ${slotLabel}`,
        },
      }));

      setIsOpen(false);
      onSuccess?.();
    } catch (error) {
      console.error("Failed to add meal to plan:", error);
      window.dispatchEvent(new CustomEvent("show-toast", {
        detail: {
          title: "Error",
          description: "Failed to add meal to your plan. Please try again.",
          variant: "destructive",
        },
      }));
    } finally {
      setIsAdding(false);
      setSelectedSlot(null);
    }
  };

  return (
    <>
      <Drawer open={isOpen} onOpenChange={(open) => { if (!isAdding) setIsOpen(open); }}>
        <Button
          size="sm"
          className={`flex-1 text-xs shadow-md hover:shadow-lg active:scale-95 transition-all duration-200 ${
            isFree
              ? "bg-green-600/50 text-white/60"
              : "bg-green-600 hover:bg-green-700 text-white"
          }`}
          onClick={handleOpenDrawer}
        >
          <CalendarPlus className="h-4 w-4 mr-1" />
          Add to Plan
          {isFree && <Lock className="h-3 w-3 ml-1 opacity-60" />}
        </Button>

        <DrawerContent className="bg-black/95 border-t border-white/20">
          {confirming ? (
            <div className="p-6 pb-10">
              <button
                onClick={() => setConfirming(false)}
                className="flex items-center gap-1 text-white/50 text-sm mb-5 active:opacity-70"
              >
                <ChevronLeft className="h-4 w-4" /> Back
              </button>
              <p className="text-white text-base font-semibold text-center mb-1">
                Replace existing meal?
              </p>
              <p className="text-white/50 text-sm text-center mb-6 px-4">
                "{occupiedMealTitle}" is already in this slot. Replacing it removes the old meal.
              </p>
              <Button
                className="w-full h-14 bg-green-600 hover:bg-green-700 text-white text-base font-semibold rounded-full mb-3 active:scale-[0.98]"
                onClick={() => selectedSlot && doAdd(selectedSlot)}
                disabled={isAdding}
              >
                {isAdding ? "Replacing…" : "Replace"}
              </Button>
              <Button
                variant="ghost"
                className="w-full h-12 text-white/60 text-base"
                onClick={() => setConfirming(false)}
                disabled={isAdding}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <>
              <DrawerHeader className="text-center pb-0">
                <DrawerTitle className="text-white text-lg">Add to Meal Plan</DrawerTitle>
                <p className="text-sm text-white/60 mt-1 truncate px-4">{meal.name || meal.title}</p>
              </DrawerHeader>

              <div className="px-4 pt-4 pb-2">
                <p className="text-xs text-white/40 uppercase tracking-widest mb-2">Day</p>
                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                  {rollingDates.map((dateISO) => {
                    const { short, dayNum, isToday } = formatDayLabel(dateISO, todayISO);
                    const active = selectedDate === dateISO;
                    return (
                      <button
                        key={dateISO}
                        onClick={() => { setSelectedDate(dateISO); setSelectedSlot(null); }}
                        className={`flex-shrink-0 flex flex-col items-center justify-center w-12 h-14 rounded-xl border transition-all active:scale-95 ${
                          active
                            ? "bg-green-600 border-green-600 text-white"
                            : "bg-white/5 border-white/15 text-white/70"
                        }`}
                      >
                        <span className={`text-[10px] font-medium ${active ? "text-white/80" : "text-white/40"}`}>
                          {isToday ? "Today" : short}
                        </span>
                        <span className="text-base font-bold leading-tight">{dayNum}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="px-4 pt-3 pb-8">
                <p className="text-xs text-white/40 uppercase tracking-widest mb-2">Slot</p>
                <div className="space-y-2">
                  {SLOT_OPTIONS.map((slot) => {
                    const occupied = isOccupied(selectedDate, slot.value);
                    const existingName = occupiedTitle(selectedDate, slot.value);
                    const isLoading = selectedSlot === slot.value && isAdding;
                    return (
                      <button
                        key={slot.value}
                        onClick={() => handleSlotTap(slot.value)}
                        disabled={isAdding}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all active:scale-[0.98] ${
                          isAdding && selectedSlot === slot.value
                            ? "opacity-60 border-white/20 bg-white/5"
                            : "border-white/15 bg-white/5 hover:bg-white/10 active:bg-white/10"
                        }`}
                      >
                        <span className="text-2xl">{slot.emoji}</span>
                        <div className="flex-1 text-left">
                          <p className="text-white font-medium text-sm">{slot.label}</p>
                          {occupied && existingName && (
                            <p className="text-white/40 text-xs truncate">{existingName}</p>
                          )}
                        </div>
                        {boardLoading ? (
                          <span className="text-white/20 text-xs">…</span>
                        ) : occupied ? (
                          <span className="text-xs text-amber-400/80 font-medium">Replace</span>
                        ) : (
                          <span className="text-xs text-green-500/70">Open</span>
                        )}
                        {isLoading && <span className="text-xs text-white/40 ml-1">Adding…</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </DrawerContent>
      </Drawer>
      <UpgradeLockModal open={showLockModal} onClose={closeLockModal} message={lockMessage} />
    </>
  );
}
