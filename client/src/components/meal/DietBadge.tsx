import type { DietType } from "@/utils/dietaryFilter";

interface DietBadgeProps {
  diet: DietType | string;
  className?: string;
}

const DIET_CONFIG: Record<string, { label: string; colors: string }> = {
  kosher: {
    label: "Kosher",
    colors: "bg-amber-900/40 border-amber-500/50 text-amber-300",
  },
  halal: {
    label: "Halal",
    colors: "bg-teal-900/40 border-teal-500/50 text-teal-300",
  },
  vegan: {
    label: "Vegan",
    colors: "bg-green-900/40 border-green-500/50 text-green-400",
  },
  vegetarian: {
    label: "Vegetarian",
    colors: "bg-green-900/40 border-green-500/50 text-green-400",
  },
  pescatarian: {
    label: "Pescatarian",
    colors: "bg-cyan-900/40 border-cyan-500/50 text-cyan-400",
  },
  keto: {
    label: "Keto",
    colors: "bg-violet-900/40 border-violet-500/50 text-violet-300",
  },
  paleo: {
    label: "Paleo",
    colors: "bg-amber-900/40 border-amber-500/50 text-amber-300",
  },
};

export default function DietBadge({ diet, className = "" }: DietBadgeProps) {
  if (!diet || diet === "omnivore") return null;
  const config = DIET_CONFIG[diet];
  if (!config) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${config.colors} ${className}`}
    >
      ✅ {config.label} compliant
    </span>
  );
}
