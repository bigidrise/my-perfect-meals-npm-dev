import { useState, useEffect } from "react";
import { Trash2, ListChecks, Camera } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  readOtherItems,
  deleteOtherItem,
  toggleOtherItemChecked,
  clearCheckedOtherItems,
  type OtherItem,
} from "@/stores/otherItemsStore";

export default function MyListCard() {
  const [items, setItems] = useState<OtherItem[]>(() => readOtherItems().items);

  useEffect(() => {
    const onUpdate = () => setItems(readOtherItems().items);
    window.addEventListener("other:items:updated", onUpdate);
    return () => window.removeEventListener("other:items:updated", onUpdate);
  }, []);

  if (items.length === 0) return null;

  const unchecked = items.filter((i) => !i.checked);
  const checked = items.filter((i) => i.checked);

  return (
    <div className="rounded-2xl border border-white/20 bg-black/60 text-white p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-orange-400" />
          <h3 className="text-base font-semibold">My List</h3>
          <span className="text-xs text-white/40 ml-1">
            {unchecked.length} item{unchecked.length !== 1 ? "s" : ""}
          </span>
        </div>
        {checked.length > 0 && (
          <button
            onClick={() => clearCheckedOtherItems()}
            className="text-[11px] text-white/40 hover:text-white/70 transition-colors"
          >
            Clear checked ({checked.length})
          </button>
        )}
      </div>

      <div className="space-y-1.5">
        {items.map((item) => (
          <div
            key={item.id}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${
              item.checked
                ? "bg-white/3 border-white/5 opacity-50"
                : "bg-white/5 border-white/10"
            }`}
          >
            <Checkbox
              checked={!!item.checked}
              onCheckedChange={() => toggleOtherItemChecked(item.id)}
              className="shrink-0 border-white/30 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
            />

            <div className="flex-1 min-w-0">
              <span
                className={`text-sm font-medium ${
                  item.checked ? "line-through text-white/40" : "text-white"
                }`}
              >
                {item.brand ? (
                  <span className="text-orange-300/80">{item.brand} </span>
                ) : null}
                {item.name}
              </span>
              {(item.qty !== 1 || item.unit !== "item") && (
                <span className="text-xs text-white/40 ml-2">
                  {item.qty} {item.unit}
                </span>
              )}
            </div>

            {item.source === "scanned" && (
              <span className="shrink-0 flex items-center gap-1 text-[10px] text-orange-400/70 bg-orange-500/10 border border-orange-500/20 rounded-full px-2 py-0.5">
                <Camera className="w-2.5 h-2.5" />
                Scanned
              </span>
            )}

            <button
              onClick={() => deleteOtherItem(item.id)}
              className="shrink-0 text-white/20 hover:text-red-400 transition-colors p-1"
              aria-label="Remove item"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
