import { useState } from "react";

const FALLBACK_FOOD =
  "https://images.unsplash.com/photo-1546793665-c74683f339c1?w=800&h=600&fit=crop&auto=format";

interface MealImageSlotProps {
  imageUrl?: string | null;
  mealName: string;
  isLoading?: boolean;
  height?: string;
  fallbackSrc?: string;
  className?: string;
}

export function MealImageSlot({
  imageUrl,
  mealName,
  isLoading = false,
  height = "h-64",
  fallbackSrc = FALLBACK_FOOD,
  className = "",
}: MealImageSlotProps) {
  const [revealed, setRevealed] = useState(false);
  const [errored, setErrored] = useState(false);

  if (isLoading) {
    return (
      <div className={`mb-6 rounded-lg overflow-hidden ${className}`}>
        <div
          className={`w-full ${height} relative overflow-hidden`}
          style={{ background: "linear-gradient(135deg, #1c1c1e 0%, #2c2c2e 100%)" }}
        >
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%)",
              animation: "mpm-shimmer 1.8s ease-in-out infinite",
            }}
          />
        </div>
      </div>
    );
  }

  const src = imageUrl && !errored ? imageUrl : fallbackSrc;

  return (
    <div className={`mb-6 rounded-lg overflow-hidden relative ${className}`}>
      {!revealed && (
        <div
          className={`absolute inset-0 w-full ${height} animate-pulse`}
          style={{ background: "linear-gradient(135deg, #1c1c1e 0%, #2c2c2e 100%)" }}
        />
      )}
      <img
        src={src}
        alt={mealName}
        className={`w-full ${height} object-cover transition-opacity duration-300 ${
          revealed ? "opacity-100" : "opacity-0"
        }`}
        onLoad={() => setRevealed(true)}
        onError={() => {
          if (!errored) {
            setErrored(true);
            setRevealed(true);
          }
        }}
      />
    </div>
  );
}
