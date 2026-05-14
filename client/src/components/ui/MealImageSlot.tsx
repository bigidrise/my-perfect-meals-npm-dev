import { useState } from "react";

export type ImageSourceType = "beverage" | "dessert" | "snack" | "sushi" | "meal";

// Stock photo fallbacks — only used when a real generated image URL itself fails to load.
// Never shown as a primary placeholder.
const FALLBACK_POOLS: Record<ImageSourceType, string[]> = {
  beverage: [
    "https://images.unsplash.com/photo-1544145945-f90425340c7e?w=800&h=600&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=800&h=600&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1570598912132-0ba1dc952b7d?w=800&h=600&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1534353436294-0dbd4bdac845?w=800&h=600&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1497534446932-c925b458314e?w=800&h=600&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1546171753-97d7676e4602?w=800&h=600&fit=crop&auto=format",
  ],
  dessert: [
    "https://images.unsplash.com/photo-1551024505-b52f4da00f8c?w=800&h=600&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=800&h=600&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=800&h=600&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&h=600&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1571115177098-24ec42ed204d?w=800&h=600&fit=crop&auto=format",
  ],
  snack: [
    "https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=800&h=600&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1621939514649-280e2ee25f60?w=800&h=600&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1562802378-063ec186a863?w=800&h=600&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=800&h=600&fit=crop&auto=format",
  ],
  sushi: [
    "https://images.unsplash.com/photo-1559410545-0bdcd187e0a6?w=800&h=600&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1611143669185-af224c5e3252?w=800&h=600&fit=crop&auto=format",
    "https://images.unsplash.com/photo-1617196034183-421b4040ed20?w=800&h=600&fit=crop&auto=format",
  ],
  meal: [
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
  ],
};

function detectTypeFromName(name: string): ImageSourceType {
  const lower = name.toLowerCase();
  if (/smoothie|shake|juice|latte|coffee|tea|cocktail|mocktail|drink|beverage|lemonade|beer|wine|soda|protein.shake|matcha|espresso|frappe|cooler|spritzer|tonic|punch|agua.fresca|horchata|kombucha|infusion|elixir/.test(lower)) return "beverage";
  if (/cake|pie|cookie|brownie|pudding|ice.cream|cheesecake|tart|mousse|cupcake|donut|pastry|macaron|tiramisu|gelato|sorbet|sundae|fudge|truffle|crepe|parfait|cobbler|dessert/.test(lower)) return "dessert";
  if (/sushi|roll|nigiri|sashimi|maki|temaki|uramaki/.test(lower)) return "sushi";
  if (/chip|cracker|pretzel|energy.bar|granola.bar|trail.mix|protein.bar/.test(lower)) return "snack";
  return "meal";
}

function hashFallback(name: string, pool: string[]): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (Math.imul(31, h) + name.charCodeAt(i)) | 0;
  }
  return pool[Math.abs(h) % pool.length];
}

const TYPE_LABELS: Record<ImageSourceType, string> = {
  beverage: "Beverage Preview",
  dessert: "Dessert Preview",
  snack: "Snack Preview",
  sushi: "Dish Preview",
  meal: "Meal Preview",
};

interface MealImageSlotProps {
  imageUrl?: string | null;
  mealName: string;
  sourceType?: ImageSourceType;
  isLoading?: boolean;
  height?: string;
  fallbackSrc?: string;
  className?: string;
}

export function MealImageSlot({
  imageUrl,
  mealName,
  sourceType,
  isLoading = false,
  height = "h-64",
  fallbackSrc,
  className = "",
}: MealImageSlotProps) {
  const [revealed, setRevealed] = useState(false);
  const [errored, setErrored] = useState(false);

  const resolvedType = sourceType ?? detectTypeFromName(mealName);
  const pool = FALLBACK_POOLS[resolvedType];
  const resolvedFallback = fallbackSrc || hashFallback(mealName, pool);
  const label = TYPE_LABELS[resolvedType];

  // Shimmer while actively loading
  if (isLoading) {
    return (
      <div className={`mb-6 rounded-lg overflow-hidden ${className}`}>
        <div
          className={`w-full ${height} relative overflow-hidden flex flex-col items-center justify-center gap-2`}
          style={{ background: "linear-gradient(135deg, #1a0a00 0%, #7c2d0e 50%, #1a0a00 100%)" }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%)",
              animation: "mpm-shimmer 1.8s ease-in-out infinite",
            }}
          />
          <div className="w-8 h-8 rounded-full border-2 border-orange-400 border-t-transparent animate-spin" />
          <span className="text-orange-300 text-sm font-medium tracking-wide">Generating image…</span>
        </div>
      </div>
    );
  }

  // Branded placeholder when no image URL came back (generation failed/timed out)
  if (!imageUrl && !errored) {
    return (
      <div className={`mb-6 rounded-lg overflow-hidden ${className}`}>
        <div
          className={`w-full ${height} flex flex-col items-center justify-center gap-3`}
          style={{ background: "linear-gradient(135deg, #1a0a00 0%, #7c2d0e 50%, #1a0a00 100%)" }}
        >
          <div className="w-12 h-12 rounded-full bg-orange-600/20 border border-orange-500/40 flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-orange-300 text-sm font-medium">{label}</p>
            <p className="text-white/40 text-xs mt-0.5">Image preview unavailable</p>
          </div>
        </div>
      </div>
    );
  }

  // Real generated image (or stock photo fallback if the generated URL itself errors)
  const src = errored ? resolvedFallback : imageUrl!;

  return (
    <div className={`mb-6 rounded-lg overflow-hidden relative ${className}`}>
      {!revealed && (
        <div
          className={`absolute inset-0 w-full ${height} animate-pulse`}
          style={{ background: "linear-gradient(135deg, #1a0a00 0%, #7c2d0e 50%, #1a0a00 100%)" }}
        />
      )}
      <img
        src={src}
        alt={mealName}
        className={`w-full ${height} object-cover transition-opacity duration-300 ${revealed ? "opacity-100" : "opacity-0"}`}
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
