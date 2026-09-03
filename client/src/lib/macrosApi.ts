/**
 * macrosApi — legacy macro logging helpers
 *
 * logMacrosToBiometrics() delegates to the canonical logMacros() helper
 * which always calls /api/macros/log (starchy/fibrous-aware).
 */

import { logMacros } from "@/lib/logMacros";

interface MacroEntry {
  date?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  mealType?: string;
}

export async function addBulkMacros(entries: MacroEntry[]): Promise<{ success: boolean; message?: string }> {
  try {
    const { apiUrl } = await import("@/lib/resolveApiBase");
    const response = await fetch(apiUrl("/api/macros/bulk"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ entries }),
    });
    if (!response.ok) throw new Error(`Failed to add bulk macros: ${response.statusText}`);
    const data = await response.json();
    return { success: true, ...data };
  } catch (error) {
    console.error("Error adding bulk macros:", error);
    return { success: false, message: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function logMacrosToBiometrics(macros: MacroEntry): Promise<{ success: boolean; message?: string }> {
  try {
    await logMacros({
      calories: macros.calories,
      protein: macros.protein,
      carbohydrates: macros.carbs,
      fat: macros.fat,
      fiber: macros.fiber ?? null,
      source: "macro-counter",
      title: "Meal from Macro Counter",
      mealType: (macros.mealType as any) ?? "lunch",
      dateIso: macros.date,
    });
    return { success: true };
  } catch (error) {
    console.error("❌ Error logging macros:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to send macros. Please try again.",
    };
  }
}
