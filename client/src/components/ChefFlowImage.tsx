import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface ChefFlowImageProps {
  src?: string;
  alt: string;
  className?: string;
  /**
   * True while a caller is enriching a card with a background image request.
   * This is deliberately separate from `src`: no URL yet can mean either
   * "still generating" or the terminal "unavailable" state.
   */
  isLoading?: boolean;
}

/**
 * ChefFlowImage — Phase 1 update
 *
 * Previous behavior: onError reset loadedSrc to null, causing an infinite shimmer.
 * The user could not tell whether the image was still loading or permanently broken.
 *
 * New behavior: onError enters a terminal UNAVAILABLE state that shows a neutral
 * branded placeholder. Never shows another food photograph.
 *
 * Full component consolidation into MealImageSlot happens in Phase 4.
 */
export function ChefFlowImage({ src, alt, className, isLoading = false }: ChefFlowImageProps) {
  const { t } = useTranslation();
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  // Reset state whenever src changes — new src means a new image attempt
  useEffect(() => {
    setLoadedSrc(null);
    setFailed(false);
  }, [src]);

  const isImageLoading = !loadedSrc && !failed && !!src;
  const showShimmer = !failed && (isLoading || isImageLoading);

  // Terminal unavailable state — delivery failed, image cannot be shown
  if (failed || (!src && !loadedSrc && !isLoading)) {
    return (
      <div
        className={cn(
          "relative w-full h-full overflow-hidden flex flex-col items-center justify-center gap-2",
          className,
        )}
        style={{ background: "linear-gradient(135deg, #1a0a00 0%, #7c2d0e 50%, #1a0a00 100%)" }}
      >
        <div className="w-10 h-10 rounded-full bg-orange-600/20 border border-orange-500/40 flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        </div>
        <span className="text-orange-300/70 text-xs">{t("imageStates.unavailable")}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative w-full h-full overflow-hidden bg-black/30",
        className,
      )}
    >
      {/* Shimmer — shown only while actively loading */}
      {showShimmer && (
        <div
          className="absolute inset-0 animate-pulse bg-gradient-to-r from-white/5 via-white/10 to-white/5"
          aria-label={t("imageStates.generating")}
        />
      )}

      {/* Image — starts hidden, fades in on successful load */}
      {src && (
        <img
          key={src}
          src={src}
          alt={alt}
          onLoad={() => setLoadedSrc(src)}
          onError={() => {
            // Phase 1: enter terminal unavailable state.
            // NEVER reset to shimmer (infinite loading lie).
            // NEVER substitute another food photograph.
            setFailed(true);
          }}
          className={cn(
            "w-full h-full object-cover transition-opacity duration-700",
            loadedSrc === src ? "opacity-100" : "opacity-0",
          )}
        />
      )}
    </div>
  );
}
