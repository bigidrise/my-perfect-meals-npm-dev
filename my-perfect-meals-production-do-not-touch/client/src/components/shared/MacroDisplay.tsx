/**
 * MacroDisplay - Shared component for displaying macros on meal cards
 * 
 * Product Rule: Meal cards show starchy/fibrous carbs, NOT calories or total carbs
 * - Protein
 * - Starchy Carbs (energy-dense: rice, pasta, bread, potatoes)
 * - Fibrous Carbs (volume-dense: vegetables, leafy greens)
 * - Fat
 * 
 * DO NOT add calories to this component per product doctrine.
 */

interface MacroDisplayProps {
  protein: number;
  carbs?: number; // Total carbs (for backward compat, not displayed)
  starchyCarbs?: number;
  fibrousCarbs?: number;
  fat: number;
  variant?: "compact" | "full";
  className?: string;
}

export function MacroDisplay({
  protein,
  starchyCarbs = 0,
  fibrousCarbs = 0,
  fat,
  variant = "compact",
  className = "",
}: MacroDisplayProps) {
  if (variant === "compact") {
    return (
      <div className={`flex flex-wrap gap-2 text-xs text-white/70 ${className}`}>
        <span>P: {Math.round(protein)}g</span>
        <span>SC: {Math.round(starchyCarbs)}g</span>
        <span>FC: {Math.round(fibrousCarbs)}g</span>
        <span>F: {Math.round(fat)}g</span>
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-4 gap-2 text-center ${className}`}>
      <div className="flex flex-col">
        <span className="text-sm font-semibold text-white">{Math.round(protein)}g</span>
        <span className="text-xs text-white/60">Protein</span>
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-semibold text-amber-400">{Math.round(starchyCarbs)}g</span>
        <span className="text-xs text-white/60">Starchy</span>
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-semibold text-green-400">{Math.round(fibrousCarbs)}g</span>
        <span className="text-xs text-white/60">Fibrous</span>
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-semibold text-white">{Math.round(fat)}g</span>
        <span className="text-xs text-white/60">Fat</span>
      </div>
    </div>
  );
}

/**
 * Helper function to format macros for display
 * Use this when you need to display macros in a custom way
 */
export function formatMacrosForDisplay(macros: {
  protein: number;
  carbs?: number;
  starchyCarbs?: number;
  fibrousCarbs?: number;
  fat: number;
  calories?: number;
}) {
  const starchy = macros.starchyCarbs ?? 0;
  const fibrous = macros.fibrousCarbs ?? 0;
  
  return {
    protein: Math.round(macros.protein),
    starchyCarbs: Math.round(starchy),
    fibrousCarbs: Math.round(fibrous),
    totalCarbs: Math.round(macros.carbs ?? (starchy + fibrous)),
    fat: Math.round(macros.fat),
    calories: Math.round(macros.calories ?? (macros.protein * 4 + (macros.carbs ?? starchy + fibrous) * 4 + macros.fat * 9)),
  };
}
