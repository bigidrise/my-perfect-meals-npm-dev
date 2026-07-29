/**
 * logMacros — canonical client-side macro logging helper
 *
 * Every "Add to Macros" button in the app calls this function.
 * No component should build its own payload or call /api/macros/log or
 * /api/biometrics/log directly for macro logging purposes.
 *
 * Route: POST /api/macros/log (canonical, starchy/fibrous-aware)
 * fibrousCarbs is derived server-side from fiber — do not send it separately.
 */

import type { MacroLogInput } from "@shared/nutritionFacts";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";

export type { MacroLogInput };

export async function logMacros(input: MacroLogInput): Promise<void> {
  const payload = {
    loggedAt: input.dateIso ?? new Date().toISOString().split("T")[0],
    mealType: input.mealType ?? "lunch",
    kcal: input.calories,
    protein: input.protein,
    carbs: input.carbohydrates,
    fat: input.fat,
    starchyCarbs: input.starchyCarbs ?? null,
    // fiber → server derives fibrousCarbs from it
    fiber: input.fiber ?? null,
    source: input.source,
    mealId: input.mealId,
    title: input.title,
  };

  const res = await fetch(apiUrl("/api/macros/log"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Macro log failed: ${res.status} ${detail}`);
  }
}
