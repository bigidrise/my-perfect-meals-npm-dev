import { useState } from "react";

const FALLBACK_POOL = [
  "https://images.unsplash.com/photo-1546793665-c74683f339c1?w=800&h=600&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&h=600&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800&h=600&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800&h=600&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&h=600&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=800&h=600&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800&h=600&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1484723091739-30a097e8f929?w=800&h=600&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=800&h=600&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&h=600&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=600&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=800&h=600&fit=crop&auto=format",
];

function hashFallback(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (Math.imul(31, h) + name.charCodeAt(i)) | 0;
  }
  return FALLBACK_POOL[Math.abs(h) % FALLBACK_POOL.length];
}

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
  fallbackSrc,
  className = "",
}: MealImageSlotProps) {
  const [revealed, setRevealed] = useState(false);
  const [errored, setErrored] = useState(false);
  const resolvedFallback = fallbackSrc || hashFallback(mealName);

  if (isLoading) {
    return (
      <div className={`mb-6 rounded-lg overflow-hidden ${className}`}>
        <div
          className={`w-full ${height} relative overflow-hidden`}
          style={{ background: "linear-gradient(135deg, #1c1c1e 0%, #2c2c2e 100%)" }}
        >
          <div
            className="mpm-shimmer-bar"
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%)",
              animation: "mpm-shimmer 1.8s ease-in-out infinite",
            }}
          />
        </div>
      </div>
    );
  }

  const src = imageUrl && !errored ? imageUrl : resolvedFallback;

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
