import type { DietType } from "@/utils/dietaryFilter";

interface DietBadgeProps {
  diet: DietType;
  className?: string;
}

const DIET_LABELS: Record<string, string> = {
  vegan: "Vegan",
  vegetarian: "Vegetarian",
  pescatarian: "Pescatarian",
};

export default function DietBadge({ diet, className = "" }: DietBadgeProps) {
  if (diet === "omnivore") return null;
  const label = DIET_LABELS[diet];
  if (!label) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-green-900/40 border border-green-500/50 px-2 py-0.5 text-xs font-medium text-green-400 ${className}`}
    >
      ✅ {label} compliant
    </span>
  );
}
