import { useState } from "react";
import { isPlaceholderImage } from "@shared/imageResult";
import { useConsumerCopy } from "@/i18n/useConsumerCopy";

/** Static fallback only; never starts image generation or repair. */
export default function GetawayMealImage({ src, name }: { src?: string; name: string }) {
  const { t } = useConsumerCopy();
  const [failed, setFailed] = useState(false);
  const photograph = !!src && !isPlaceholderImage(src) && !failed;
  return <img src={photograph ? src : "/assets/ChefBlackApron.png"}
    alt={photograph ? name : t("Flame Chef mascot — not a meal photograph")}
    onError={photograph ? () => setFailed(true) : undefined}
    className={`h-16 w-16 shrink-0 rounded-xl border border-white/10 bg-black ${photograph ? "object-cover" : "object-contain"}`} />;
}
