import { ChefHat } from "lucide-react";
import type { PlateItem } from "@shared/restaurantServing";

/** Unchanged Buffet item markup shared by all restaurant plate presentations. */
export default function PlateItems({ items, translatedFoods }: { items: PlateItem[]; translatedFoods?: string[] }) {
  return <div className="flex flex-col gap-1.5">
    {items.map((item, i) => <div key={i} className="flex items-start gap-2">
      <ChefHat className="w-3 h-3 text-orange-400/60 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <span className="text-xs text-white font-medium">{translatedFoods?.[i] || item.food}</span>
        <span className="text-xs text-white/80"> · {item.portion}</span>
        {item.note && <p className="text-[10px] text-white/70 leading-snug">{item.note}</p>}
      </div>
    </div>)}
  </div>;
}
