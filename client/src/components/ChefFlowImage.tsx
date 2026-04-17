import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface ChefFlowImageProps {
  src?: string;
  alt: string;
  className?: string;
}

export function ChefFlowImage({ src, alt, className }: ChefFlowImageProps) {
  const [revealed, setRevealed] = useState(false);
  const prevSrc = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (prevSrc.current !== src) {
      prevSrc.current = src;
      setRevealed(false);
    }
  }, [src]);

  return (
    <div
      className={cn(
        "relative w-full h-full overflow-hidden bg-black/30",
        className,
      )}
    >
      {/* Shimmer — visible until image fades in */}
      {!revealed && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-white/5 via-white/10 to-white/5" />
      )}

      {/* Image — opacity-0 until loaded, then fades in */}
      {src && (
        <img
          src={src}
          alt={alt}
          onLoad={() => setRevealed(true)}
          onError={() => setRevealed(true)}
          className={cn(
            "w-full h-full object-cover transition-opacity duration-500",
            revealed ? "opacity-100" : "opacity-0",
          )}
        />
      )}

      {/* Fallback icon when no src available */}
      {!src && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-4xl opacity-30">🍽️</span>
        </div>
      )}
    </div>
  );
}
