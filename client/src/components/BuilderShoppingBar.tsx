import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { ShoppingCart, CalendarDays, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useShoppingListStore } from "@/stores/shoppingListStore";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { getDayLists, type WeekBoard } from "@/lib/boardApi";
import { normalizeIngredients } from "@/utils/ingredientParser";
import { formatDateDisplay } from "@/utils/midnight";

type Props = {
  board: WeekBoard | null;
  activeDayISO: string | null;
  weekDatesList: string[];
  sourceSlug?: string;
};

export default function BuilderShoppingBar({
  board,
  activeDayISO,
  weekDatesList,
  sourceSlug,
}: Props) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const isDesktop = useIsDesktop();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);

  const dayMealCounts = useMemo(() => {
    if (!board) return {} as Record<string, number>;
    const counts: Record<string, number> = {};
    weekDatesList.forEach((date) => {
      const lists = getDayLists(board, date);
      counts[date] =
        lists.breakfast.length +
        lists.lunch.length +
        lists.dinner.length +
        lists.snacks.length;
    });
    return counts;
  }, [board, weekDatesList]);

  const totalMeals = Object.values(dayMealCounts).reduce((a, b) => a + b, 0);

  if (!board || !activeDayISO || totalMeals === 0) return null;

  function collectIngredients(days: string[]) {
    if (!board) return [];
    const allMeals = days.flatMap((date) => {
      const lists = getDayLists(board, date);
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
    const dayName = formatDateDisplay(activeDayISO, { weekday: "long" });
    sendDays([activeDayISO], `${dayName} Meal Plan`);
  }

  function handleConfirmDays() {
    if (selectedDays.length === 0) return;
    const label =
      selectedDays.length === 1
        ? `${formatDateDisplay(selectedDays[0], { weekday: "long" })} Meal Plan`
        : `${selectedDays.length}-Day Meal Plan`;
    sendDays(selectedDays, label);
  }

  function toggleDay(date: string) {
    setSelectedDays((prev) =>
      prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date],
    );
  }

  const activeDayName = formatDateDisplay(activeDayISO, { weekday: "long" });

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
            <div className="text-white text-sm font-semibold mb-3">
              Choose days for your shopping list (select 1–7)
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              {weekDatesList.map((date) => {
                const count = dayMealCounts[date] || 0;
                const selected = selectedDays.includes(date);
                const label = formatDateDisplay(date, {
                  weekday: "short",
                  month: "numeric",
                  day: "numeric",
                });
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
                        {count === 0
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
              onClick={() => {
                setPickerOpen((p) => !p);
                if (!pickerOpen) setSelectedDays([]);
              }}
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
