import { useState, useMemo, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { ShoppingCart, CalendarDays, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useShoppingListStore } from "@/stores/shoppingListStore";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { getDayLists, type WeekBoard } from "@/lib/boardApi";
import { normalizeIngredients } from "@/utils/ingredientParser";
import { formatDateDisplay, addDaysISOSafe, getWeekStartFromDate } from "@/utils/midnight";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { getActiveBuilderNs } from "@/lib/activeBuilderNs";

const TZ = "America/Chicago";

type Props = {
  board: WeekBoard | null;
  activeDayISO: string | null;
  currentWeekStartISO: string;
  sourceSlug?: string;
};

export default function BuilderShoppingBar({
  board,
  activeDayISO,
  currentWeekStartISO,
  sourceSlug,
}: Props) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const isDesktop = useIsDesktop();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [fetchingWeeks, setFetchingWeeks] = useState(false);

  const extraBoardsRef = useRef<Record<string, WeekBoard | null>>({});
  const [extraBoardsVersion, setExtraBoardsVersion] = useState(0);

  const anchorDateISO = activeDayISO || currentWeekStartISO;

  const rollingDates = useMemo(() => {
    if (!anchorDateISO) return [];
    return Array.from({ length: 7 }, (_, i) => addDaysISOSafe(anchorDateISO, i, TZ));
  }, [anchorDateISO]);

  const fetchExtraWeeks = useCallback(async (dates: string[]) => {
    const weekStarts = [...new Set(dates.map((d) => getWeekStartFromDate(d, TZ)))];
    const missing = weekStarts.filter(
      (ws) => ws !== currentWeekStartISO && extraBoardsRef.current[ws] === undefined
    );
    if (missing.length === 0) return;

    setFetchingWeeks(true);
    try {
      await Promise.all(
        missing.map(async (ws) => {
          try {
            const ns = getActiveBuilderNs();
            const btParam = ns ? `&bt=${encodeURIComponent(ns)}` : "";
            const res = await fetch(
              apiUrl(`/api/weekly-board?week=${encodeURIComponent(ws)}${btParam}`),
              { credentials: "include", headers: { ...getAuthHeaders() } }
            );
            if (!res.ok) {
              extraBoardsRef.current[ws] = null;
              return;
            }
            const json = await res.json();
            extraBoardsRef.current[ws] = json?.week || null;
          } catch {
            extraBoardsRef.current[ws] = null;
          }
        })
      );
      setExtraBoardsVersion((v) => v + 1);
    } finally {
      setFetchingWeeks(false);
    }
  }, [currentWeekStartISO]);

  function getDayListsMultiWeek(dateISO: string) {
    const ws = getWeekStartFromDate(dateISO, TZ);
    if (ws === currentWeekStartISO && board) {
      return getDayLists(board, dateISO);
    }
    const extraBoard = extraBoardsRef.current[ws];
    if (extraBoard) {
      return getDayLists(extraBoard, dateISO);
    }
    return { breakfast: [], lunch: [], dinner: [], snacks: [], meal4: [], meal5: [], meal6: [] };
  }

  const currentWeekMealCount = useMemo(() => {
    if (!board) return 0;
    const weekDates = Array.from({ length: 7 }, (_, i) =>
      addDaysISOSafe(currentWeekStartISO, i, TZ)
    );
    return weekDates.reduce((sum, date) => {
      const lists = getDayLists(board, date);
      return sum + lists.breakfast.length + lists.lunch.length + lists.dinner.length + lists.snacks.length;
    }, 0);
  }, [board, currentWeekStartISO]);

  if (!board || !activeDayISO || currentWeekMealCount === 0) return null;

  const dayMealCounts = rollingDates.reduce<Record<string, number>>((acc, date) => {
    const lists = getDayListsMultiWeek(date);
    acc[date] = lists.breakfast.length + lists.lunch.length + lists.dinner.length + lists.snacks.length;
    return acc;
  }, {});

  function collectIngredients(days: string[]) {
    const allMeals = days.flatMap((date) => {
      const lists = getDayListsMultiWeek(date);
      return [
        ...lists.breakfast,
        ...lists.lunch,
        ...lists.dinner,
        ...lists.snacks,
      ];
    });
    return normalizeIngredients(allMeals.flatMap((m) => m.ingredients || []));
  }

  function sendDays(days: string[], label: string) {
    const ingredients = collectIngredients(days);
    if (ingredients.length === 0) {
      toast({
        title: "No meals found",
        description: "Add meals to your plan first.",
        variant: "destructive",
      });
      return;
    }
    const items = ingredients.map((i) => ({
      name: i.name,
      quantity:
        typeof i.qty === "number"
          ? i.qty
          : i.qty
            ? parseFloat(String(i.qty))
            : 1,
      unit: i.unit || "",
      notes: label,
    }));
    useShoppingListStore.getState().addItems(items);
    toast({
      title: "Added to Shopping List",
      description: `${ingredients.length} items added to your Smart Grocery List`,
    });
    const url = sourceSlug
      ? `/shopping-list-v2?from=${sourceSlug}`
      : "/shopping-list-v2";
    setLocation(url);
    setPickerOpen(false);
    setSelectedDays([]);
  }

  function handleSendDay() {
    if (!activeDayISO) return;
    const dayName = formatDateDisplay(activeDayISO, { weekday: "long" }, TZ);
    sendDays([activeDayISO], `${dayName} Meal Plan`);
  }

  function handleConfirmDays() {
    if (selectedDays.length === 0) return;
    const label =
      selectedDays.length === 1
        ? `${formatDateDisplay(selectedDays[0], { weekday: "long" }, TZ)} Meal Plan`
        : `${selectedDays.length}-Day Meal Plan`;
    sendDays(selectedDays, label);
  }

  function toggleDay(date: string) {
    setSelectedDays((prev) =>
      prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date]
    );
  }

  function handleOpenPicker() {
    const nowOpen = !pickerOpen;
    setPickerOpen(nowOpen);
    if (nowOpen) {
      setSelectedDays([]);
      fetchExtraWeeks(rollingDates);
    }
  }

  const activeDayName = formatDateDisplay(activeDayISO, { weekday: "long" }, TZ);

  const barStyle = isDesktop
    ? { left: 240, right: 0, bottom: 0 }
    : {
        left: 0,
        right: 0,
        bottom: "calc(64px + var(--safe-bottom, 0px))",
      };

  return (
    <div className="fixed z-[60]" style={barStyle}>
      {pickerOpen && (
        <div className="bg-zinc-950/98 backdrop-blur-xl border-t border-white/20 px-4 py-4">
          <div className="container mx-auto">
            <div className="text-white text-sm font-semibold mb-1">
              Choose days for your shopping list
            </div>
            <div className="text-white/40 text-xs mb-3">
              {fetchingWeeks ? "Loading…" : "Next 7 days from today's selected day"}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              {rollingDates.map((date) => {
                const count = dayMealCounts[date] || 0;
                const selected = selectedDays.includes(date);
                const label = formatDateDisplay(date, {
                  weekday: "short",
                  month: "numeric",
                  day: "numeric",
                }, TZ);
                return (
                  <button
                    key={date}
                    onClick={() => toggleDay(date)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all text-left ${
                      selected
                        ? "bg-emerald-600 border-emerald-400 text-white"
                        : count === 0
                          ? "bg-white/5 border-white/10 text-white/40 cursor-pointer"
                          : "bg-white/10 border-white/20 text-white hover:bg-white/15"
                    }`}
                  >
                    {selected ? (
                      <Check className="h-4 w-4 flex-shrink-0" />
                    ) : (
                      <div className="h-4 w-4 flex-shrink-0 rounded border border-white/30" />
                    )}
                    <div className="min-w-0">
                      <div className="font-medium truncate">{label}</div>
                      <div className="text-xs opacity-70">
                        {fetchingWeeks && getWeekStartFromDate(date, TZ) !== currentWeekStartISO
                          ? "Loading…"
                          : count === 0
                            ? "No meals"
                            : `${count} meal${count !== 1 ? "s" : ""}`}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setPickerOpen(false);
                  setSelectedDays([]);
                }}
                className="flex-1 text-white/70 border border-white/20 hover:bg-white/10 min-h-[44px]"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmDays}
                disabled={selectedDays.length === 0}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white min-h-[44px]"
                data-testid="button-confirm-days-shopping"
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                {selectedDays.length > 0
                  ? `Send ${selectedDays.length} Day${selectedDays.length !== 1 ? "s" : ""}`
                  : "Send Days"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-gradient-to-r from-zinc-900/95 via-zinc-800/95 to-black/95 backdrop-blur-xl border-t border-white/20 shadow-2xl">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="text-white text-sm font-semibold flex-1 hidden sm:block">
              Shopping Ready
            </div>
            <Button
              onClick={handleSendDay}
              className="flex-1 sm:flex-none min-h-[44px] bg-orange-600 hover:bg-orange-700 text-white border border-white/30"
              data-testid="button-send-day-shopping"
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              Send {activeDayName}
            </Button>
            <Button
              onClick={handleOpenPicker}
              className={`flex-1 sm:flex-none min-h-[44px] border border-white/30 text-white ${
                pickerOpen
                  ? "bg-emerald-700 hover:bg-emerald-800"
                  : "bg-zinc-700 hover:bg-zinc-600"
              }`}
              data-testid="button-choose-days-shopping"
            >
              <CalendarDays className="h-4 w-4 mr-2" />
              Choose Days
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
