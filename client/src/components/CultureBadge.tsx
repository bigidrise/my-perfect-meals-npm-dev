import { useAuth } from "@/contexts/AuthContext";

function capitalizeCuisine(cuisine: string): string {
  if (!cuisine) return "";
  const map: Record<string, string> = {
    "middle eastern": "Middle Eastern",
    "american": "American",
    "neutral_american": "No preference",
  };
  const lower = cuisine.toLowerCase();
  if (map[lower]) return map[lower];
  return cuisine.charAt(0).toUpperCase() + cuisine.slice(1);
}

function capitalizeIntensity(intensity: string): string {
  const map: Record<string, string> = { light: "Light", balanced: "Balanced", authentic: "Authentic" };
  return map[intensity.toLowerCase()] || intensity;
}

interface CultureBadgeProps {
  className?: string;
}

export default function CultureBadge({ className = "" }: CultureBadgeProps) {
  const { user } = useAuth();
  const cuisine = user?.cuisinePreference;
  const intensity = user?.cuisineIntensity;

  const hasNoPref = !cuisine || cuisine === "neutral_american";

  const displayText = hasNoPref
    ? "Using your culture: No preference"
    : `Using your culture: ${capitalizeCuisine(cuisine!)}${intensity ? ` (${capitalizeIntensity(intensity)})` : ""}`;

  return (
    <p className={`text-xs text-white/35 flex items-center gap-1 ${className}`}>
      <span>🌍</span>
      <span>{displayText}</span>
    </p>
  );
}
