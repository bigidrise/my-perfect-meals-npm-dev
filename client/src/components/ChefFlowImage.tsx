import { useState } from "react";
import { cn } from "@/lib/utils";

interface ChefFlowImageProps {
  src?: string;
  alt: string;
  className?: string;
}

export function ChefFlowImage({ src, alt, className }: ChefFlowImageProps) {
  const [loadedSrc, setLoadedSrc] = useState<string | undefined>(undefined);

  return (
    <div
      className={cn(
        "relative w-full h-full overflow-hidden bg-black/30",
        className,
      )}
    >
      {/* Shimmer — visible whenever the current src hasn't finished loading */}
      {loadedSrc !== src && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-white/5 via-white/10 to-white/5" />
      )}

      {/* key={src} forces a fresh img element each time the URL changes,
          so it always starts at opacity-0 and fades in — no pop-in flash */}
      {src && (
        <img
          key={src}
          src={src}
          alt={alt}
          onLoad={() => setLoadedSrc(src)}
          onError={() => setLoadedSrc(src)}
          className={cn(
            "w-full h-full object-cover transition-opacity duration-700",
            loadedSrc === src ? "opacity-100" : "opacity-0",
          )}
        />
      )}

      {/* Placeholder icon when no src is available yet */}
      {!src && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-4xl opacity-30">🍽️</span>
        </div>
      )}
    </div>
  );
}
