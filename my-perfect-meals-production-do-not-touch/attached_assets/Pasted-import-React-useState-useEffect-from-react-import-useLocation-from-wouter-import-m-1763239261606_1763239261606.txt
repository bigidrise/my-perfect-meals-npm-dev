import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Drawer, DrawerTrigger } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { TEMPLATE_SETS } from "@/data/templateSets";
import { useOnboardingProfile } from "@/hooks/useOnboardingProfile";
import MenuBuilderGuidedTour from "@/components/guided/MenuBuilderGuidedTour";
import { Meal } from "@/components/MealCard";
import MealPickerDrawer from "@/components/pickers/MealPickerDrawer";
import { cn } from "@/lib/utils";
import { ChevronLeft } from "lucide-react";

// ⛑️ Anti-Inflammatory Guardrails
import { ANTI_INFLAMMATORY_PRESETS } from "@/data/antiInflammatoryPresets";

export default function AntiInflammatoryMenuBuilder() {
  const [location, setLocation] = useLocation();
  const profile = useOnboardingProfile();

  // -------------------------------
  // PAGE LOAD
  // -------------------------------
  useEffect(() => {
    document.title = "Anti-Inflammatory Meal Board | My Perfect Meals";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  const [currentPreset, setCurrentPreset] = useState("Inflammation Relief");
  const [showInfoModal, setShowInfoModal] = useState(false);

  // -------------------------------
  // WEEKLY MEAL STATE
  // -------------------------------
  const [weekMeals, setWeekMeals] = useState(() => {
    try {
      const stored = localStorage.getItem("antiInflammatory-weekMeals");
      return stored ? JSON.parse(stored) : TEMPLATE_SETS.weeklyEmpty;
    } catch {
      return TEMPLATE_SETS.weeklyEmpty;
    }
  });

  useEffect(() => {
    localStorage.setItem(
      "antiInflammatory-weekMeals",
      JSON.stringify(weekMeals)
    );
  }, [weekMeals]);

  // -------------------------------
  // MEAL PICKER
  // -------------------------------
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerList, setPickerList] = useState<
    "breakfast" | "lunch" | "dinner" | "snacks" | null
  >(null);

  const openPicker = (list: any) => {
    setPickerList(list);
    setPickerOpen(true);
  };

  const handlePickMeal = (meal: Meal) => {
    const updated = { ...weekMeals };
    updated[pickerList!] = meal;
    setWeekMeals(updated);
    setPickerOpen(false);
  };

  // -------------------------------
  // CLEAR MEALS
  // -------------------------------
  const resetWeek = () => {
    setWeekMeals(TEMPLATE_SETS.weeklyEmpty);
  };

  // -------------------------------
  // PAGE RETURN
  // -------------------------------
  const goBack = () => setLocation("/planner");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen bg-gradient-to-br from-[#0f0f0f] via-[#1a1a1a] to-[#2b2b2b] pb-24 flex flex-col"
    >
      <MenuBuilderGuidedTour />

      {/* HEADER */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-black/30 backdrop-blur-xl border-b border-white/10">
        <div className="px-4 py-3 flex items-center gap-3">
          <button
            className="flex items-center text-white/80 hover:text-white"
            onClick={goBack}
          >
            <ChevronLeft className="h-6 w-6 text-orange-500" />
          </button>
          <h1 className="text-lg font-bold text-white">
            Anti-Inflammatory Meal Board
          </h1>

          <button
            onClick={() => setShowInfoModal(true)}
            className="ml-auto bg-orange-600 hover:bg-orange-700 text-white text-xs px-3 py-1.5 rounded-lg"
          >
            ?
          </button>
        </div>
      </div>

      {/* CONTENT */}
      <div className="flex-1 px-4 pt-20 pb-10 max-w-2xl mx-auto space-y-6">

        {/* PRESET SELECTOR */}
        <div className="flex flex-col gap-2">
          <label className="text-white/80 text-sm font-semibold">
            Guardrail Preset
          </label>

          <select
            className="bg-black/40 text-white border border-white/20 rounded-xl px-3 py-2"
            value={currentPreset}
            onChange={(e) => setCurrentPreset(e.target.value)}
          >
            {Object.keys(ANTI_INFLAMMATORY_PRESETS).map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          <p className="text-xs text-white/70 leading-snug">
            {ANTI_INFLAMMATORY_PRESETS[currentPreset].description}
          </p>
        </div>

        {/* WEEKLY MEAL GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {["breakfast", "lunch", "dinner", "snacks"].map((slot) => {
            const meal = (weekMeals as any)[slot];
            return (
              <div
                key={slot}
                className="rounded-xl border border-white/10 bg-black/20 p-4"
              >
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-sm font-semibold capitalize text-white">
                    {slot}
                  </h3>

                  <button
                    className="text-xs bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded-lg"
                    onClick={() => openPicker(slot as any)}
                  >
                    Add
                  </button>
                </div>

                {meal ? (
                  <div className="space-y-1">
                    <p className="text-white text-sm">{meal.title}</p>

                    {meal.nutrition && (
                      <p className="text-white/60 text-xs">
                        {meal.nutrition.calories} kcal · P {meal.nutrition.protein} · C{" "}
                        {meal.nutrition.carbs} · F {meal.nutrition.fat}
                      </p>
                    )}

                    <button
                      onClick={() => {
                        const updated = { ...weekMeals };
                        updated[slot] = null;
                        setWeekMeals(updated);
                      }}
                      className="text-xs text-red-400 hover:text-red-300 mt-2"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <p className="text-white/50 text-xs">No meal selected</p>
                )}
              </div>
            );
          })}
        </div>

        {/* CLEAR BUTTON */}
        <button
          className="mt-4 bg-red-600 hover:bg-red-700 text-white w-full py-2 rounded-xl"
          onClick={resetWeek}
        >
          Clear All Meals
        </button>
      </div>

      {/* MEAL PICKER */}
      <MealPickerDrawer
        open={pickerOpen}
        list={pickerList}
        onClose={() => setPickerOpen(false)}
        onPick={handlePickMeal}
      />

      {/* INFO MODAL */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-black/30 backdrop-blur-lg border border-white/20 rounded-2xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-xl font-bold text-white mb-4">
              Anti-Inflammatory Meal Builder
            </h3>

            <div className="text-white/80 text-sm space-y-3">
              <p>
                This specialized meal builder is designed for individuals managing
                **autoimmune and inflammatory conditions** such as:
              </p>

              <ul className="list-disc list-inside space-y-1 text-white/80">
                <li>Rheumatoid Arthritis (RA)</li>
                <li>Raynaud’s Phenomenon</li>
                <li>Lupus</li>
                <li>Hashimoto’s & Thyroid Autoimmune Disorders</li>
                <li>Sjögren’s Syndrome</li>
                <li>Psoriatic Arthritis</li>
                <li>Mixed Connective Tissue Disorders</li>
              </ul>

              <p className="pt-3">
                **Guardrails** ensure meals avoid common inflammation triggers such as:
              </p>
              <ul className="list-disc list-inside text-white/80 space-y-1">
                <li>Processed oils & artificial fats</li>
                <li>High-sugar or refined carbohydrates</li>
                <li>Red meat overload</li>
                <li>Excess sodium</li>
                <li>Inflammatory additives</li>
              </ul>

              <p className="pt-3 text-white/90">
                Choose meals through the **AI templates**, cafeteria quick-pick,
                or build through ingredient pickers.
              </p>
            </div>

            <button
              className="mt-6 w-full bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-xl"
              onClick={() => setShowInfoModal(false)}
            >
              Got it!
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
