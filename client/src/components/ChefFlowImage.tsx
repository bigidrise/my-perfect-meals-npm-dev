import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface ChefFlowImageProps {
  src?: string;
  alt: string;
  className?: string;
}

export function ChefFlowImage({ src, alt, className }: ChefFlowImageProps) {
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);

  const isLoading = !loadedSrc;

  // Reset loading state whenever src changes — guarantees shimmer restarts
  // on new results, re-runs, or navigation between pages
  useEffect(() => {
    setLoadedSrc(null);
  }, [src]);

  return (
    <div
      className={cn(
        "relative w-full h-full overflow-hidden bg-black/30",
        className,
      )}
    >
      {/* Shimmer — state-driven, shows until image is confirmed loaded */}
      {isLoading && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-white/5 via-white/10 to-white/5" />
      )}

      {/* Image — starts hidden, fades in on load */}
      {src && (
        <img
          key={src}
          src={src}
          alt={alt}
          onLoad={() => setLoadedSrc(src)}
          onError={() => setLoadedSrc(null)}
          className={cn(
            "w-full h-full object-cover transition-opacity duration-700",
            loadedSrc === src ? "opacity-100" : "opacity-0",
          )}
        />
      )}
    </div>
  );
}
