/**
 * MacroConfirmSheet
 *
 * Bottom drawer for confirming and logging an AwayFromHomeRecommendation.
 * Handles:
 *   - Meal slot selection (pill buttons, no radio buttons)
 *   - Date selection (today default, rolling 14 days)
 *   - Editable macro fields (always available; required for "estimated" status)
 *   - Log to Macros action (POST /api/biometrics/log)
 *   - Add to Plan action (POST /api/weekly-board/:week/slot)
 *
 * This component only knows about AwayFromHomeRecommendation.
 * It does not know whether the recommendation came from any specific feature.
 */

import { useState, useCallback } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { NUTRITION_DISCLOSURE } from "@shared/awayFromHome";
import type { AwayFromHomeRecommendation } from "@shared/awayFromHome";
import {
  toMacroLogPayload,
  toMealPlanItemPayload,
  macrosAreEditable,
} from "./awayFromHomeTranslator";
import { logMacros } from "@/lib/logMacros";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { getActiveBuilderNs } from "@/lib/activeBuilderNs";
import {
  getTodayISOSafe,
  getWeekStartFromDate,
  formatDateDisplay,
} from "@/utils/midnight";
import { getRolling14Days } from "@/utils/dateRange";
import { cn } from "@/lib/utils";

// ── Constants ─────────────────────────────────────────────────────────────────

const TZ = "America/Chicago";

type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";

const SLOT_OPTIONS: { value: MealSlot; label: string }[] = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch",     label: "Lunch" },
  { value: "dinner",    label: "Dinner" },
  { value: "snack",     label: "Snack" },
];

// ── Props ─────────────────────────────────────────────────────────────────────

interface MacroConfirmSheetProps {
  recommendation: AwayFromHomeRecommendation | null;
  open: boolean;
  onClose: () => void;
  /** Called after a successful log or plan add. */
  onSuccess?: (action: "logged" | "planned") => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MacroConfirmSheet({
  recommendation,
  open,
  onClose,
  onSuccess,
}: MacroConfirmSheetProps) {
  const todayISO = getTodayISOSafe(TZ);
  const rollingDates = getRolling14Days(todayISO);

  const [selectedSlot, setSelectedSlot] = useState<MealSlot>("lunch");
  const [selectedDate, setSelectedDate] = useState<string>(todayISO);

  // Editable macro state — pre-seeded from recommendation
  const [calories, setCalories] = useState<string>("");
  const [protein, setProtein] = useState<string>("");
  const [carbs, setCarbs] = useState<string>("");
  const [fat, setFat] = useState<string>("");

  const [logging, setLogging] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-seed macro fields whenever the recommendation changes
  const seedMacros = useCallback((rec: AwayFromHomeRecommendation) => {
    setCalories(String(rec.meal.calories ?? ""));
    setProtein(String(rec.meal.proteinGrams ?? ""));
    setCarbs(String(rec.meal.carbohydrateGrams ?? ""));
    setFat(String(rec.meal.fatGrams ?? ""));
  }, []);

  // Seed on open
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      onClose();
      setError(null);
    } else if (recommendation) {
      seedMacros(recommendation);
    }
  };

  if (!recommendation) return null;

  const isEditable = macrosAreEditable(recommendation);
  const disclosure = NUTRITION_DISCLOSURE[recommendation.nutritionStatus];

  const macroOverrides = {
    calories: calories !== "" ? Number(calories) : undefined,
    proteinGrams: protein !== "" ? Number(protein) : undefined,
    carbohydrateGrams: carbs !== "" ? Number(carbs) : undefined,
    fatGrams: fat !== "" ? Number(fat) : undefined,
  };

  // ── Log to Macros ──────────────────────────────────────────────────────────

  async function handleLogToMacros() {
    setLogging(true);
    setError(null);
    try {
      const payload = toMacroLogPayload(recommendation!, {
        dateIso: selectedDate,
        mealType: selectedSlot,
        ...macroOverrides,
      });
      await logMacros(payload);
      onSuccess?.("logged");
      onClose();
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong. Please try again.");
    } finally {
      setLogging(false);
    }
  }

  // ── Add to Plan ────────────────────────────────────────────────────────────

  async function handleAddToPlan() {
    setPlanning(true);
    setError(null);
    try {
      const weekStart = getWeekStartFromDate(selectedDate, TZ);
      const ns = getActiveBuilderNs();
      const btParam = ns ? `&bt=${encodeURIComponent(ns)}` : "";

      // Board slot uses "snacks" for snack entries
      const boardSlot = selectedSlot === "snack" ? "snacks" : selectedSlot;
      const item = toMealPlanItemPayload(recommendation!, macroOverrides);

      const res = await fetch(
        apiUrl(`/api/weekly-board/${weekStart}/slot?slot=${boardSlot}&date=${selectedDate}${btParam}`),
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify(item),
        }
      );
      if (!res.ok) throw new Error(`Plan add failed: ${res.status}`);
      onSuccess?.("planned");
      onClose();
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong. Please try again.");
    } finally {
      setPlanning(false);
    }
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent className="bg-black/95 border-t border-white/10 text-white max-h-[90dvh] overflow-y-auto">
        <DrawerHeader className="pb-0">
          <DrawerTitle className="text-white text-base font-semibold">
            {recommendation.meal.name}
          </DrawerTitle>
          <p className="text-white/50 text-xs mt-0.5">{recommendation.restaurantName}</p>
        </DrawerHeader>

        <div className="px-4 pb-8 space-y-5 mt-3">

          {/* ── Macros ─────────────────────────────────────────────────── */}
          <div>
            <p className="text-xs text-white/50 uppercase tracking-wide mb-2">
              {isEditable ? "Adjust macros before logging" : "Nutrition"}
            </p>

            {/* Range hint for estimated items */}
            {recommendation.meal.caloriesRange && (
              <p className="text-xs text-orange-400/80 mb-2">
                Estimated range: {recommendation.meal.caloriesRange.low}–{recommendation.meal.caloriesRange.high} cal
              </p>
            )}

            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "Cal", value: calories, set: setCalories },
                { label: "Protein", value: protein, set: setProtein },
                { label: "Carbs",   value: carbs,   set: setCarbs },
                { label: "Fat",     value: fat,      set: setFat },
              ].map(({ label, value, set }) => (
                <div key={label} className="flex flex-col items-center">
                  <label className="text-[10px] text-white/40 mb-1">{label}</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={value}
                    onChange={(e) => set(e.target.value)}
                    readOnly={!isEditable}
                    className={cn(
                      "w-full text-center text-sm font-semibold rounded-lg py-2 bg-white/8 border text-white",
                      isEditable
                        ? "border-orange-500/40 focus:border-orange-500 focus:outline-none"
                        : "border-white/10 cursor-default"
                    )}
                  />
                  {recommendation.nutritionStatus === "estimated" && (
                    <span className="text-[9px] text-orange-400/70 mt-0.5">est.</span>
                  )}
                </div>
              ))}
            </div>

            <p className="text-[10px] text-white/30 mt-2 leading-relaxed">{disclosure}</p>
          </div>

          {/* ── Date selector ──────────────────────────────────────────── */}
          <div>
            <p className="text-xs text-white/50 uppercase tracking-wide mb-2">Date</p>
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {rollingDates.slice(0, 14).map((dateISO) => {
                const isToday = dateISO === todayISO;
                const shortDay = formatDateDisplay(dateISO, { weekday: "short" }, TZ);
                const dayNum = formatDateDisplay(dateISO, { day: "numeric" }, TZ);
                const selected = selectedDate === dateISO;
                return (
                  <button
                    key={dateISO}
                    onClick={() => setSelectedDate(dateISO)}
                    className={cn(
                      "flex flex-col items-center px-2.5 py-1.5 rounded-lg shrink-0 min-w-[44px] transition-colors",
                      selected
                        ? "bg-orange-600 text-white"
                        : "bg-white/8 text-white/60"
                    )}
                  >
                    <span className="text-[9px] uppercase">{isToday ? "Today" : shortDay}</span>
                    <span className="text-sm font-semibold">{dayNum}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Meal slot selector ─────────────────────────────────────── */}
          <div>
            <p className="text-xs text-white/50 uppercase tracking-wide mb-2">Meal slot</p>
            <div className="flex gap-2 flex-wrap">
              {SLOT_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setSelectedSlot(value)}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
                    selectedSlot === value
                      ? "bg-orange-600 text-white"
                      : "bg-white/10 text-white/70"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Error ──────────────────────────────────────────────────── */}
          {error && (
            <p className="text-sm text-red-400 bg-red-900/20 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* ── Actions ────────────────────────────────────────────────── */}
          <div className="flex flex-col gap-2 pt-1">
            <button
              onClick={handleLogToMacros}
              disabled={logging || planning}
              className="w-full py-3 rounded-xl bg-orange-600 text-white font-semibold text-sm disabled:opacity-50 transition-opacity"
            >
              {logging ? "Logging…" : "Log to Macros"}
            </button>
            <button
              onClick={handleAddToPlan}
              disabled={logging || planning}
              className="w-full py-3 rounded-xl bg-white/10 text-white font-semibold text-sm disabled:opacity-50 transition-opacity"
            >
              {planning ? "Adding…" : "Add to Meal Plan"}
            </button>
          </div>

        </div>
      </DrawerContent>
    </Drawer>
  );
}
