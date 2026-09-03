import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { get, post } from "@/lib/api";
import { isFirstPartyPermanentImageUrl } from "@shared/mediaImageUrls";

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

export function withImageDeliveryRetry(url: string, retry: number): string {
  if (!retry) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}delivery-retry=${retry}`;
}

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

function RecoveringPlaceholder({
  label,
  statusLabel,
  height,
  className,
}: {
  label: string;
  statusLabel: string;
  height: string;
  className: string;
}) {
  return (
    <div className={`mb-6 rounded-lg overflow-hidden ${className}`}>
      <div
        className={`w-full ${height} flex flex-col items-center justify-center gap-3`}
        style={{ background: "linear-gradient(135deg, #1a0a00 0%, #7c2d0e 50%, #1a0a00 100%)" }}
      >
        <div className="w-8 h-8 rounded-full border-2 border-orange-400 border-t-transparent animate-spin" />
        <div className="text-center">
          <p className="text-orange-300 text-sm font-medium">{label}</p>
          <p className="text-white/40 text-xs mt-0.5">{statusLabel}</p>
        </div>
      </div>
    </div>
  );
}

interface MealImageSlotProps {
  imageUrl?: string | null;
  mealName: string;
  sourceType?: ImageSourceType;
  /** Recipe contract used to safely regenerate a confirmed-broken image. */
  ingredients?: Array<string | { name?: string; item?: string }>;
  /** Present for saved meals, so recovery can replace the persisted asset. */
  savedMealId?: string;
  mediaAssetId?: string | null;
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
  ingredients,
  savedMealId,
  mediaAssetId,
  isLoading = false,
  height = "h-64",
  className = "",
}: MealImageSlotProps) {
  const { t } = useTranslation();
  const [revealed, setRevealed] = useState(false);
  // true = image load failed; show neutral unavailable state, never another food
  const [failed, setFailed] = useState(false);
  const [recoveryState, setRecoveryState] = useState<"idle" | "restoring">("idle");
  const [recoveredUrl, setRecoveredUrl] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const recoveryAttempted = useRef(false);
  const recoveryVersion = useRef(0);
  const mounted = useRef(true);

  const resolvedType = sourceType ?? detectTypeFromName(mealName);
  const label = TYPE_LABELS[resolvedType];
  const renderedUrl = withImageDeliveryRetry(recoveredUrl ?? imageUrl ?? "", retryNonce);

  useEffect(() => {
    // A new server-supplied URL starts a new display lifecycle. This is distinct
    // from the one replacement URL generated for an onError in this component.
    recoveryAttempted.current = false;
    setRecoveredUrl(null);
    setFailed(false);
    setRevealed(false);
    setRecoveryState("idle");
    setRetryNonce(0);
    recoveryVersion.current += 1;
  }, [imageUrl, savedMealId, mediaAssetId]);

  useEffect(() => () => {
    mounted.current = false;
  }, []);

  const requestRecovery = async () => {
    if (!isFirstPartyPermanentImageUrl(imageUrl) || recoveryAttempted.current) {
      setFailed(true);
      return;
    }

    recoveryAttempted.current = true;
    setRecoveryState("restoring");
    const requestVersion = recoveryVersion.current;
    const canUpdate = () => mounted.current && requestVersion === recoveryVersion.current;

    try {
      // Generator and board cards have a durable URL but no saved-meal asset
      // relationship. They must not call the persistence recovery endpoints,
      // but they still deserve one retry after a transient storage read error.
      if (!savedMealId || !mediaAssetId) {
        await new Promise((resolve) => window.setTimeout(resolve, 700));
        if (canUpdate()) {
          setRetryNonce(1);
          setRecoveryState("idle");
          setFailed(false);
          setRevealed(false);
        }
        return;
      }

      // Object Storage can distinguish a 404 from a temporary delivery outage
      // and can offer a surviving thumbnail/display/original variant. Do that
      // no-cost recovery before considering image generation.
      if (imageUrl?.startsWith("/public-objects/")) {
        const delivery = await post<{
          status: "retry" | "recovered" | "unavailable";
          imageUrl?: string;
          reason?: "missing" | "unsupported";
        }>("/api/media/image-delivery-recovery", { imageUrl, savedMealId, mediaAssetId });

        if (!canUpdate()) return;
        if ((delivery.status === "retry" || delivery.status === "recovered") && delivery.imageUrl) {
          setRecoveredUrl(delivery.imageUrl);
          setRetryNonce(delivery.status === "retry" ? 1 : 0);
          setRecoveryState("idle");
          setFailed(false);
          setRevealed(false);
          return;
        }
        if (delivery.status !== "unavailable" || delivery.reason !== "missing") {
          setRecoveryState("idle");
          setFailed(true);
          return;
        }
      }

      // Only confirmed-missing Object Storage objects (or legacy first-party
      // S3 URLs that have no Object Storage probe) reach the paid, recipe-aware
      // regeneration queue.
      const queued = await post<{ accepted: boolean; recoveryId?: string }>(
        "/api/meal-images/recover",
        {
          imageUrl,
          mealName,
          ingredients,
          sourceType: resolvedType === "sushi" ? "meal" : resolvedType,
          savedMealId,
          mediaAssetId,
        },
      );

      if (!queued.accepted || !queued.recoveryId) {
        if (canUpdate()) {
          setRecoveryState("idle");
          setFailed(true);
        }
        return;
      }

      // Polling observes the one background generation job; it does not start
      // another generation. Once ready, the image element receives exactly one
      // replacement URL and will never loop if that URL also fails.
      const poll = async (attempt: number): Promise<void> => {
        try {
          const recovery = await get<{ status: "pending" | "ready" | "failed"; imageUrl?: string }>(
            `/api/meal-images/recover/${queued.recoveryId}`,
          );
          if (!canUpdate()) return;
          if (recovery.status === "ready" && recovery.imageUrl) {
            setRecoveredUrl(recovery.imageUrl);
            setRecoveryState("idle");
            setFailed(false);
            setRevealed(false);
            return;
          }
          if (recovery.status === "failed" || attempt >= 119) {
            setRecoveryState("idle");
            setFailed(true);
            return;
          }
        } catch {
          if (canUpdate()) {
            setRecoveryState("idle");
            setFailed(true);
          }
          return;
        }
        window.setTimeout(() => void poll(attempt + 1), 1_000);
      };

      void poll(0);
    } catch {
      if (canUpdate()) {
        setRecoveryState("idle");
        setFailed(true);
      }
    }
  };

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

  // No image URL — generation failed or not yet completed
  if (!renderedUrl) {
    return <UnavailablePlaceholder label={label} height={height} className={className} />;
  }

  if (recoveryState === "restoring") {
    return <RecoveringPlaceholder label={label} statusLabel={t("imageStates.restoring")} height={height} className={className} />;
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
        src={renderedUrl}
        alt={mealName}
        className={`w-full ${height} object-cover transition-opacity duration-300 ${revealed ? "opacity-100" : "opacity-0"}`}
        onLoad={() => setRevealed(true)}
        onError={() => {
          // Delivery failed: Object Storage URLs get one background recovery
          // attempt. All other delivery failures remain neutral unavailable.
          // NEVER substitute another food photograph.
          setRevealed(false);
          void requestRecovery();
        }}
      />
    </div>
  );
}
