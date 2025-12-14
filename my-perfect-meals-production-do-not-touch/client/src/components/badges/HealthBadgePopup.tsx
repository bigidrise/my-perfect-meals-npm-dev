import { useState } from "react";
import { Eye } from "lucide-react";

const CRITICAL_BADGE_TEXT_MATCHES = [
  "cardiac",
  "heart",
  "heart-healthy",
  "low sodium",
  "renal",
  "kidney",
  "glp-1",
  "glp1",
  "diabetes",
  "diabetic",
];

const MAP: Record<string, { label: string; desc: string }> = {
  heart: { label: "Heart-friendly", desc: "Better for heart health" },
  sugar_low: { label: "Lower sugar", desc: "Lower in added sugar" },
  sodium_low: { label: "Lower sodium", desc: "Lower in sodium" },
  fiber_high: { label: "High fiber", desc: "High in fiber" },
  protein_high: { label: "High protein", desc: "High in protein" },
  balanced: { label: "Balanced", desc: "Balanced protein, carbs, and fat" },
  allergen: { label: "Allergen", desc: "Contains common allergens" },
  glp1_friendly: { label: "GLP-1 friendly", desc: "Helps GLP-1 goals" },
};

function normalize(
  keys?: string[],
): { key: string; label: string; desc: string }[] {
  if (!keys?.length) return [];
  return keys
    .filter((k) => k != null && k !== "")
    .map((k) => {
      const canon =
        k in MAP
          ? k
          : k === "low_sugar"
            ? "sugar_low"
            : k === "low_sodium"
              ? "sodium_low"
              : k === "high_fiber"
                ? "fiber_high"
                : k === "high_protein"
                  ? "protein_high"
                  : k;
      const meta = MAP[canon] ?? { label: canon.replace(/_/g, " "), desc: "" };
      return { key: canon, label: meta.label, desc: meta.desc };
    })
    .filter((v, i, a) => a.findIndex((x) => x.key === v.key) === i);
}

export default function HealthBadgePopup({
  badges,
  className = "",
}: {
  badges?: string[];
  className?: string;
}) {
  const [showPopup, setShowPopup] = useState(false);
  const items = normalize(badges);

  if (items.length === 0) return null;

  const isCritical = (key: string) =>
    CRITICAL_BADGE_TEXT_MATCHES.some((match) => key.includes(match));
  const hasCriticalBadge = items.some((item) => isCritical(item.key));

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setShowPopup(!showPopup)}
        onBlur={() => setTimeout(() => setShowPopup(false), 200)}
        className={`
          w-10 h-10 rounded-xl flex items-center justify-center transition-all touch-manipulation
          bg-amber-500 hover:bg-amber-600
          ${
            hasCriticalBadge
              ? "border-2 border-red-500 flash-border-critical ring-2 ring-red-500 ring-offset-1"
              : "border-2 border-amber-300"
          }
        `}
        aria-label="View health badges"
        data-testid="button-health-badge-popup"
      >
        <div className="relative flex items-center justify-center">
          <div className="absolute w-8 h-8 rounded-full bg-amber-400/30 border border-amber-600/40" />
          <Eye
            className="w-6 h-6 text-black relative z-10"
            strokeWidth={2.5}
            style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.3))" }}
          />
        </div>
      </button>

      {showPopup && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-64 rounded-lg bg-black/30 backdrop-blur-lg border border-white/20 p-3 shadow-2xl"
          data-testid="popup-health-badges"
        >
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-black/30" />

          <h4 className="text-white font-semibold text-sm mb-2">
            Health Badges
          </h4>
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.key}
                className="flex items-start gap-2"
                data-testid={`badge-row-${item.key}`}
              >
                <span
                  className={`inline-flex h-2 w-2 rounded-full ${isCritical(item.key) ? "bg-red-400 animate-pulse" : "bg-yellow-400"} mt-1.5 flex-shrink-0`}
                />
                <div>
                  <div
                    className="font-medium text-white text-xs"
                    data-testid={`text-badge-label-${item.key}`}
                  >
                    {item.label}
                  </div>
                  {item.desc && (
                    <div
                      className="text-white/70 text-xs"
                      data-testid={`text-badge-desc-${item.key}`}
                    >
                      {item.desc}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
