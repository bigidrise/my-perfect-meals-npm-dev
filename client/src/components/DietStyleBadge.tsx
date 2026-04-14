// client/src/components/DietStyleBadge.tsx
// Shows a small pill on meal cards confirming the meal fits the user's dietary style.
//
// For vegan / vegetarian / pescatarian the badge is ONLY shown when
// mealCompliant === true (post-generation validation confirmed compliance).
// undefined ("never validated") and false ("failed / unresolvable") both suppress
// the badge for these diets — "we didn't check" must never look like "we verified".
import { useAuth } from "@/contexts/AuthContext";
import { useProClient } from "@/contexts/ProClientContext";

const DIET_CONFIG: Record<string, { label: string; color: string }> = {
  keto:           { label: "Keto ✓",          color: "bg-purple-500/20 border-purple-400/40 text-purple-300" },
  vegan:          { label: "Vegan ✓",          color: "bg-green-500/20 border-green-400/40 text-green-300" },
  vegetarian:     { label: "Vegetarian ✓",     color: "bg-emerald-500/20 border-emerald-400/40 text-emerald-300" },
  pescatarian:    { label: "Pescatarian ✓",    color: "bg-blue-500/20 border-blue-400/40 text-blue-300" },
  mediterranean:  { label: "Mediterranean ✓",  color: "bg-amber-500/20 border-amber-400/40 text-amber-300" },
  paleo:          { label: "Paleo ✓",          color: "bg-orange-500/20 border-orange-400/40 text-orange-300" },
  custom:         { label: "Custom Diet ✓",    color: "bg-pink-500/20 border-pink-400/40 text-pink-300" },
};

// These diets require post-generation validation before the badge may be shown.
const VALIDATION_REQUIRED = new Set(["vegan", "vegetarian", "pescatarian"]);

const SKIP = new Set(["no-restriction", "no_restriction", "none", ""]);

interface DietStyleBadgeProps {
  className?: string;
  /**
   * Controls badge visibility for validation-required diets (vegan / vegetarian / pescatarian).
   *
   * - true      → post-generation validation passed → show badge
   * - false     → validation failed or unresolvable → suppress badge
   * - undefined → meal was never validated (cached / legacy / no pipeline data)
   *               → ALSO suppress badge — "not checked" ≠ "verified"
   *
   * Non-validated diets (keto, paleo, etc.) always show unless explicitly false.
   */
  mealCompliant?: boolean;
}

export default function DietStyleBadge({ className = "", mealCompliant }: DietStyleBadgeProps) {
  const { user } = useAuth();
  const { isProCareMode } = useProClient();
  const restrictions: string[] = (user as any)?.dietaryRestrictions ?? [];

  // In Pro Care Mode the logged-in user is a coach — their own diet
  // has nothing to do with the client's meals, so hide the badge entirely.
  if (isProCareMode) return null;

  const active = restrictions
    .map((r) => r.toLowerCase().trim())
    .filter((r) => !SKIP.has(r) && DIET_CONFIG[r])
    .filter((r) => {
      if (VALIDATION_REQUIRED.has(r)) {
        // Strict gate: badge only when compliance is explicitly confirmed.
        // false  → failed validation  → suppress
        // undefined → never validated → suppress (same as unverified)
        // true   → validated pass    → show
        return mealCompliant === true;
      }
      // Non-validated diets (keto, paleo, etc.): show unless explicitly false.
      return mealCompliant !== false;
    });

  if (active.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {active.map((key) => {
        const { label, color } = DIET_CONFIG[key];
        return (
          <span
            key={key}
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${color}`}
          >
            {label}
          </span>
        );
      })}
    </div>
  );
}
