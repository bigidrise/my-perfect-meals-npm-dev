import React from "react";
import type { MacroItem } from "@/types/macro";
import { kcal } from "@/utils/macros";

export default function EntryRow({ item, onQty, onRemove }: {
  item: MacroItem;
  onQty: (qty: number) => void;
  onRemove: () => void;
}) {
  const cals = kcal(item.protein, item.carbs, item.fat) * item.qty;

  return (
    <div className="rounded-xl border border-zinc-700/70 bg-zinc-900/60 px-3 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
      <div>
        <div className="text-sm font-medium">{item.name}</div>
        <div className="text-xs opacity-70">
          {item.protein}P / {item.carbs}C / {item.fat}F × {item.qty} • {cals} kcal
        </div>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs opacity-70">Qty</label>
        <input
          type="number"
          min={0}
          step={1}
          value={item.qty}
          onChange={(e) => onQty(Number(e.target.value))}
          className="w-20 rounded-md bg-zinc-900/70 border border-zinc-700/70 px-2 py-1 text-sm"
        />
        <button
          onClick={onRemove}
          className="rounded-md bg-zinc-800 hover:bg-zinc-700 px-2 py-1 text-xs"
        >
          Remove
        </button>
      </div>
    </div>
  );
}
