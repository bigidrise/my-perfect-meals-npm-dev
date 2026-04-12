// client/src/components/DietStyleBadge.tsx
// Shows a small pill on meal cards confirming the meal fits the user's dietary style
import { useAuth } from "@/contexts/AuthContext";

const DIET_CONFIG: Record<string, { label: string; color: string }> = {
  keto:           { label: "Keto ✓",          color: "bg-purple-500/20 border-purple-400/40 text-purple-300" },
  vegan:          { label: "Vegan ✓",          color: "bg-green-500/20 border-green-400/40 text-green-300" },
  vegetarian:     { label: "Vegetarian ✓",     color: "bg-emerald-500/20 border-emerald-400/40 text-emerald-300" },
  pescatarian:    { label: "Pescatarian ✓",    color: "bg-blue-500/20 border-blue-400/40 text-blue-300" },
  mediterranean:  { label: "Mediterranean ✓",  color: "bg-amber-500/20 border-amber-400/40 text-amber-300" },
  paleo:          { label: "Paleo ✓",          color: "bg-orange-500/20 border-orange-400/40 text-orange-300" },
  custom:         { label: "Custom Diet ✓",    color: "bg-pink-500/20 border-pink-400/40 text-pink-300" },
};

const SKIP = new Set(["no-restriction", "no_restriction", "none", ""]);

export default function DietStyleBadge({ className = "" }: { className?: string }) {
  const { user } = useAuth();
  const restrictions: string[] = (user as any)?.dietaryRestrictions ?? [];

  const active = restrictions
    .map((r) => r.toLowerCase().trim())
    .filter((r) => !SKIP.has(r) && DIET_CONFIG[r]);

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
