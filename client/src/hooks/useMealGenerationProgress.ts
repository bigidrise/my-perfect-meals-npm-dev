import { useEffect, useMemo, useState } from "react";
import {
  getMealGenerationCopy,
  startMealProgressRotation,
  type MealGenerationContext,
  type MealGenerationMode,
} from "@/lib/mealGenerationProgress";

export function useMealGenerationProgress(
  active: boolean,
  context: MealGenerationContext,
  mode: MealGenerationMode,
  intervalMs = 5000,
) {
  const copy = useMemo(
    () => getMealGenerationCopy(context, mode),
    [context, mode],
  );
  const [message, setMessage] = useState(copy.messages[0] ?? "");

  useEffect(() => {
    setMessage(copy.messages[0] ?? "");
    if (!active) return;
    const rotation = startMealProgressRotation(
      copy.messages,
      setMessage,
      intervalMs,
    );
    return rotation.stop;
  }, [active, copy, intervalMs]);

  return { title: copy.title, message };
}