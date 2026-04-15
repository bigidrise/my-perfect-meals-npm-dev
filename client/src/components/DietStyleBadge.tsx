// client/src/components/DietStyleBadge.tsx
//
// PIPELINE RULE: Server is the authority. medicalBadges = truth. UI = display only.
//
// Primary source: `badges` prop (from meal.medicalBadges, set by server validation).
// Fallback: user.dietaryRestrictions + user.dietType — ONLY when badges is undefined/null
//           (no validation ran at all — legacy/cached meals predating the pipeline).
//           [] = server said "nothing" → respect it, never fall back.
// mealCompliant is gone. That system was the bug.
import { useAuth } from "@/contexts/AuthContext";
import { useProClient } from "@/contexts/ProClientContext";

const DIET_CONFIG: Record<string, { label: string; color: string }> = {
  kosher:         { label: "Kosher ✓",         color: "bg-amber-500/20 border-amber-400/40 text-amber-300" },
  halal:          { label: "Halal ✓",           color: "bg-teal-500/20 border-teal-400/40 text-teal-300" },
  vegan:          { label: "Vegan ✓",           color: "bg-green-500/20 border-green-400/40 text-green-300" },
  vegetarian:     { label: "Vegetarian ✓",      color: "bg-emerald-500/20 border-emerald-400/40 text-emerald-300" },
  pescatarian:    { label: "Pescatarian ✓",     color: "bg-blue-500/20 border-blue-400/40 text-blue-300" },
  mediterranean:  { label: "Mediterranean ✓",   color: "bg-amber-500/20 border-amber-400/40 text-amber-300" },
  paleo:          { label: "Paleo ✓",           color: "bg-orange-500/20 border-orange-400/40 text-orange-300" },
  keto:           { label: "Keto ✓",            color: "bg-purple-500/20 border-purple-400/40 text-purple-300" },
  "gluten-free":  { label: "Gluten-Free ✓",    color: "bg-yellow-500/20 border-yellow-400/40 text-yellow-300" },
  "dairy-free":   { label: "Dairy-Free ✓",     color: "bg-cyan-500/20 border-cyan-400/40 text-cyan-300" },
  custom:         { label: "Custom Diet ✓",     color: "bg-pink-500/20 border-pink-400/40 text-pink-300" },
};

const SKIP = new Set(["no-restriction", "no_restriction", "none", ""]);

interface DietStyleBadgeProps {
  className?: string;
  /**
   * Server-validated badge list from meal.medicalBadges.
   * When present (even if empty), this is the single source of truth.
   * Fallback to user profile only when this prop is not provided.
   */
  badges?: string[];
}

export default function DietStyleBadge({ className = "", badges }: DietStyleBadgeProps) {
  const { user } = useAuth();
  const { isProCareMode } = useProClient();

  // Pro Care Mode: logged-in user is a coach — hide entirely.
  if (isProCareMode) return null;

  let activeKeys: string[];

  if (badges != null) {
    // PRIMARY PATH: server provided a validated badge list (even if empty).
    // [] = "validated — nothing passed" → show nothing, do NOT fall back.
    // undefined/null = "no validation ran" → fall through to fallback.
    activeKeys = badges
      .map((b) => b.toLowerCase().trim())
      .filter((b) => !SKIP.has(b) && DIET_CONFIG[b]);
  } else {
    // FALLBACK PATH: no validation context at all (legacy/cached meal).
    // Read from user profile — dietaryRestrictions array first, then dietType.
    const userRestrictions: string[] = (user as any)?.dietaryRestrictions ?? [];
    const userDietType: string = (user as any)?.dietType ?? "";

    const fallback = [
      ...userRestrictions,
      ...(userDietType ? [userDietType] : []),
    ]
      .map((r) => r.toLowerCase().trim())
      .filter((r) => !SKIP.has(r) && DIET_CONFIG[r]);

    // Deduplicate
    activeKeys = [...new Set(fallback)];
  }

  if (activeKeys.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {activeKeys.map((key) => {
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
