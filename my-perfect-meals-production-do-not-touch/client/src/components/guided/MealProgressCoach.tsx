
import { useEffect, useMemo, useState } from "react";
import { nextIncomplete, setCompleted, MealId } from "@/lib/mealProgress";

/**
 * MealProgressCoach
 * - Highlights the next incomplete meal card's "Create AI Meal" button.
 * - Listens for `meal:saved` events to mark completion and move on.
 * - Only runs if coachMode === "guided".
 *
 * Requirements on each meal card:
 *  - data-meal-id="breakfast" | "lunch" | "dinner" | "snack1" | "snack2"
 *  - A "Create AI Meal" trigger inside the card with
 *      data-role="create-ai-meal"
 */

const COACH_ON = () => localStorage.getItem("coachMode") === "guided";

export default function MealProgressCoach() {
  const [enabled, setEnabled] = useState(COACH_ON());
  const [focusId, setFocusId] = useState<MealId | null>(null);

  // Detect which meal cards are present on this board (in case some hubs differ)
  const presentMeals = useMemo<MealId[]>(() => {
    if (typeof document === "undefined") return [];
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-meal-id]"));
    const ids = nodes
      .map((n) => n.getAttribute("data-meal-id") as MealId | null)
      .filter((v): v is MealId => !!v);
    return ids;
  }, []);

  // Find next incomplete when mounted or when meals change
  useEffect(() => {
    if (!enabled) return;
    const next = nextIncomplete(presentMeals);
    setFocusId(next);
    highlight(next);
    return () => removeAllHighlights();
  }, [enabled, presentMeals]);

  // Listen for meal saved events and advance
  useEffect(() => {
    if (!enabled) return;
    const onSaved = (e: Event) => {
      const detail = (e as CustomEvent).detail as { mealId?: MealId } | undefined;
      const id = detail?.mealId;
      if (!id) return;
      setCompleted(id);
      removeAllHighlights();
      const next = nextIncomplete(presentMeals);
      setFocusId(next);
      highlight(next);
    };
    window.addEventListener("meal:saved", onSaved as EventListener);
    return () => window.removeEventListener("meal:saved", onSaved as EventListener);
  }, [enabled, presentMeals]);

  if (!enabled) return null;

  return null;
}

/** Utilities */

function highlight(mealId: MealId | null) {
  if (!mealId) return;
  const card = document.querySelector<HTMLElement>(`[data-meal-id="${mealId}"]`);
  if (!card) return;
  const btn = card.querySelector<HTMLElement>('[data-role="create-ai-meal"]');
  card.classList.add("coach-card-focus");
  if (btn) btn.classList.add("flash-green-strong");
}

function removeAllHighlights() {
  document.querySelectorAll(".coach-card-focus").forEach((el) => el.classList.remove("coach-card-focus"));
  document.querySelectorAll('[data-role="create-ai-meal"]').forEach((el) => el.classList.remove("flash-green-strong"));
}
