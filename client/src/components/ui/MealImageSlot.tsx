import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/queryClient";

export type ImageSourceType = "beverage" | "dessert" | "snack" | "sushi" | "meal";

// Phase 1: FALLBACK_POOLS and hashFallback() have been removed.
// An image delivery failure must never silently become another food.
// Failed images show a neutral branded "unavailable" state instead.

const TYPE_LABELS: Record<ImageSourceType, string> = {
  beverage: "Beverage Preview",
  dessert: "Dessert Preview",
  snack: "Snack Preview",
  sushi: "Dish Preview",
  meal: "Meal Preview",
};

function detectTypeFromName(name: string): ImageSourceType {
  const lower = name.toLowerCase();
  if (/smoothie|shake|juice|latte|coffee|tea|cocktail|mocktail|drink|beverage|lemonade|beer|wine|soda|protein.shake|matcha|espresso|frappe|cooler|spritzer|tonic|punch|agua.fresca|horchata|kombucha|infusion|elixir/.test(lower)) return "beverage";
  if (/cake|pie|cookie|brownie|pudding|ice.cream|cheesecake|tart|mousse|cupcake|donut|pastry|macaron|tiramisu|gelato|sorbet|sundae|fudge|truffle|crepe|parfait|cobbler|dessert/.test(lower)) return "dessert";
  if (/sushi|roll|nigiri|sashimi|maki|temaki|uramaki/.test(lower)) return "sushi";
  if (/chip|cracker|pretzel|energy.bar|granola.bar|trail.mix|protein.bar/.test(lower)) return "snack";
  return "meal";
}

/** Neutral branded placeholder shown when image generation or delivery failed. */
function UnavailablePlaceholder({
  label,
  height,
  className,
}: {
  label: string;
  height: string;
  className: string;
}) {
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
          <p className="text-white/40 text-xs mt-0.5">Image unavailable</p>
        </div>
      </div>
    </div>
  );
}

interface MealImageSlotProps {
  imageUrl?: string | null;
  mealName: string;
  sourceType?: ImageSourceType;
  isLoading?: boolean;
  height?: string;
  /** @deprecated No longer used. Kept for interface compat only — ignored. */
  fallbackSrc?: string;
  className?: string;
}

export function MealImageSlot({
  imageUrl,
  mealName,
  sourceType,
  isLoading = false,
  height = "h-64",
  className = "",
}: MealImageSlotProps) {
  const [revealed, setRevealed] = useState(false);
  // true = image load failed; show neutral unavailable state, never another food
  const [failed, setFailed] = useState(false);
  const [activeImageUrl, setActiveImageUrl] = useState(imageUrl ?? null);
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryAttempted, setRecoveryAttempted] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);

  const resolvedType = sourceType ?? detectTypeFromName(mealName);
  const label = TYPE_LABELS[resolvedType];

  // A new image URL is a new delivery attempt. Reset the bounded recovery state.
  useEffect(() => {
    setActiveImageUrl(imageUrl ?? null);
    setRevealed(false);
    setFailed(false);
    setIsRecovering(false);
    setRecoveryAttempted(false);
    setRetryNonce(0);
  }, [imageUrl]);

  const reportPermanentDeliveryFailure = async () => {
    if (
      !activeImageUrl?.startsWith("/public-objects/") ||
      recoveryAttempted
    ) {
      setFailed(true);
      return;
    }

    setRecoveryAttempted(true);
    setIsRecovering(true);
    try {
      const result = await apiRequest<{
        status: "retry" | "recovered" | "unavailable";
        imageUrl?: string;
      }>("/api/media/image-delivery-recovery", {
        method: "POST",
        body: JSON.stringify({ imageUrl: activeImageUrl }),
      });

      if (result.status === "recovered" && result.imageUrl) {
        setActiveImageUrl(result.imageUrl);
        setRetryNonce(0);
        return;
      }
      if (result.status === "retry" && result.imageUrl) {
        setActiveImageUrl(result.imageUrl);
        setRetryNonce((nonce) => nonce + 1);
        return;
      }
      setFailed(true);
    } catch {
      // The recovery check itself is unavailable. Stay honest rather than
      // leaving an infinite loading state or retrying unboundedly.
      setFailed(true);
    } finally {
      setIsRecovering(false);
    }
  };

  // Shimmer while actively loading
  if (isLoading || isRecovering) {
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
          <span className="text-orange-300 text-sm font-medium tracking-wide">
            {isRecovering ? "Restoring image…" : "Generating image…"}
          </span>
        </div>
      </div>
    );
  }

  // No image URL — generation failed or not yet completed
  if (!activeImageUrl) {
    return <UnavailablePlaceholder label={label} height={height} className={className} />;
  }

  // Delivery failed — image URL existed but could not be loaded
  if (failed) {
    return <UnavailablePlaceholder label={label} height={height} className={className} />;
  }

  // Successful path: render the actual generated image
  return (
    <div className={`mb-6 rounded-lg overflow-hidden relative ${className}`}>
      {!revealed && (
        <div
          className={`absolute inset-0 w-full ${height} animate-pulse`}
          style={{ background: "linear-gradient(135deg, #1a0a00 0%, #7c2d0e 50%, #1a0a00 100%)" }}
        />
      )}
      <img
        key={`${activeImageUrl}:${retryNonce}`}
        src={retryNonce ? `${activeImageUrl}${activeImageUrl.includes("?") ? "&" : "?"}image-retry=${retryNonce}` : activeImageUrl}
        alt={mealName}
        className={`w-full ${height} object-cover transition-opacity duration-300 ${revealed ? "opacity-100" : "opacity-0"}`}
        onLoad={() => setRevealed(true)}
        onError={() => {
          // Browser onError does not expose 404 vs 503. Ask the server to
          // distinguish a confirmed-missing object from a retryable outage.
          // The component will make at most one controlled retry.
          setRevealed(false);
          void reportPermanentDeliveryFailure();
        }}
      />
    </div>
  );
}
