import { useState } from "react";
import { isPlaceholderImage } from "@shared/imageResult";

/** Static fallback only; never starts image generation or repair. */
export default function GetawayMealImage({ src, name }: { src?: string; name: string }) {
  const [failed, setFailed] = useState(false);
  const photograph = !!src && !isPlaceholderImage(src) && !failed;
  return <img src={photograph ? src : "/assets/ChefBlackApron.png"}
    alt={photograph ? name : "Flame Chef mascot — not a meal photograph"}
    onError={photograph ? () => setFailed(true) : undefined}
    className={`h-16 w-16 shrink-0 rounded-xl border border-white/10 bg-black ${photograph ? "object-cover" : "object-contain"}`} />;
}
