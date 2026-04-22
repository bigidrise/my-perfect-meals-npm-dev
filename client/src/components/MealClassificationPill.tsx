// client/src/components/MealClassificationPill.tsx
//
// SECONDARY pill — shows meal-level classification alongside the primary diet identity pill.
//
// RULES:
//   - NEVER replaces the primary DietStyleBadge pill (which comes from user profile)
//   - Only renders when dietClassification data is present from the server
//   - Never derives classification from instruction text — only from structured data
//   - Must not contradict complianceSection — server validateDietConsistency() handles
//     this gate before the data reaches the client (null is returned on mismatch)
//   - Pro Care Mode: hidden (matches DietStyleBadge behaviour)
import { useProClient } from "@/contexts/ProClientContext";

export interface DietClassification {
  kosherCategory?: "meat" | "dairy" | "pareve";
  halalFlags?: {
    alcoholFree: boolean;
    porkFree: boolean;
  };
  veganFlags?: {
    plantBased: boolean;
  };
}

interface MealClassificationPillProps {
  dietClassification?: DietClassification | null;
  className?: string;
}

/** Derive the secondary pill label + color from structured classification data */
function resolveSecondaryPill(
  dc: DietClassification,
): { label: string; color: string } | null {
  // Kosher sub-category
  if (dc.kosherCategory) {
    const map: Record<string, { label: string; color: string }> = {
      meat:   { label: "Meat",   color: "bg-red-500/15 border-red-400/30 text-red-300" },
      dairy:  { label: "Dairy",  color: "bg-blue-500/15 border-blue-400/30 text-blue-300" },
      pareve: { label: "Pareve", color: "bg-amber-500/15 border-amber-400/30 text-amber-300" },
    };
    return map[dc.kosherCategory] ?? null;
  }

  // Halal flags — show most specific status
  if (dc.halalFlags) {
    if (dc.halalFlags.alcoholFree && dc.halalFlags.porkFree) {
      return { label: "Alcohol-Free · Pork-Free", color: "bg-teal-500/15 border-teal-400/30 text-teal-300" };
    }
    if (dc.halalFlags.alcoholFree) {
      return { label: "Alcohol-Free", color: "bg-teal-500/15 border-teal-400/30 text-teal-300" };
    }
    if (dc.halalFlags.porkFree) {
      return { label: "Pork-Free", color: "bg-teal-500/15 border-teal-400/30 text-teal-300" };
    }
  }

  // Vegan
  if (dc.veganFlags?.plantBased) {
    return { label: "Plant-Based", color: "bg-green-500/15 border-green-400/30 text-green-300" };
  }

  return null;
}

export default function MealClassificationPill({
  dietClassification,
  className = "",
}: MealClassificationPillProps) {
  const { isProCareMode } = useProClient();

  if (isProCareMode) return null;
  if (!dietClassification) return null;

  const pill = resolveSecondaryPill(dietClassification);
  if (!pill) return null;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${pill.color} ${className}`}
    >
      {pill.label}
    </span>
  );
}
