// ADD-ONLY
import React, { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import type { CapturedItem } from "./CaptureBar";

type Props = {
  open: boolean;
  onClose: () => void;
  items: CapturedItem[];
  userId: string;
};

function dedupe(items: CapturedItem[]): CapturedItem[] {
  const key = (i: CapturedItem) => [i.name.toLowerCase().trim(), i.brand?.toLowerCase()?.trim() || "", i.unit || ""].join("|");
  const map = new Map<string, CapturedItem>();
  for (const it of items) {
    const k = key(it);
    if (!map.has(k)) map.set(k, { ...it });
    else map.get(k)!.quantity += it.quantity;
  }
  return Array.from(map.values());
}

export default function CaptureInbox({ open, onClose, items, userId }: Props) {
  const [lines, setLines] = useState<CapturedItem[]>([]);
  const { toast } = useToast();
  useEffect(() => { setLines(dedupe(items)); }, [items]);

  function updateLine(idx: number, patch: Partial<CapturedItem>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  async function addToShoppingList() {
    try {
      // Convert captured items to shopping items and send to shopping pad
      const shoppingItems = lines.map(it => ({
        id: crypto.randomUUID(),
        name: it.name,
        qty: it.quantity,
        unit: it.unit || undefined,
        source: 'manual' as const,
        category: undefined
      }));
      
      // Use the shopping pad link system
      const { shoppingPadHref } = await import('@/utils/shoppingPad/link');
      const href = shoppingPadHref(shoppingItems);
      window.location.href = href;
      
      onClose();
      toast({
        title: "✅ Added to Shopping List",
        description: `Successfully added ${lines.length} items to your shopping list.`,
      });
    } catch {
      toast({
        title: "❌ Error",
        description: "Some items failed to add. Please try again.",
        variant: "destructive",
      });
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-end md:items-center justify-center p-0 md:p-6">
      <div className="bg-white w-full md:max-w-lg rounded-t-2xl md:rounded-2xl p-4 space-y-3">
        <div className="flex justify-between items-center">
          <div className="text-lg font-semibold">Review items</div>
          <button className="text-sm opacity-70" onClick={onClose}>Close</button>
        </div>

        <div className="space-y-2 max-h-[50vh] overflow-auto">
          {lines.map((l, i) => (
            <div key={i} className="flex items-center gap-2 border rounded p-2">
              <div className="flex-1">
                <div className="font-medium">{l.name}{l.brand ? ` • ${l.brand}` : ""}</div>
                <div className="text-xs opacity-70">{l.unit ? `Unit: ${l.unit}` : "No unit"}</div>
              </div>
              <input
                type="number"
                min={0.25}
                step={0.25}
                value={l.quantity}
                onChange={(e) => updateLine(i, { quantity: parseFloat(e.target.value || "0") })}
                className="w-24 border rounded px-2 py-1 text-right"
              />
              <input
                type="text"
                value={l.unit || ""}
                onChange={(e) => updateLine(i, { unit: e.target.value || null })}
                placeholder="unit"
                className="w-24 border rounded px-2 py-1"
              />
              <button className="text-xs opacity-70" onClick={() => setLines((prev)=>prev.filter((_,idx)=>idx!==i))}>Remove</button>
            </div>
          ))}
          {!lines.length && <div className="text-sm opacity-70">No items to review.</div>}
        </div>

        <div className="flex justify-end gap-2">
          <button className="border rounded px-3 py-2" onClick={onClose}>Cancel</button>
          <button className="bg-black text-white rounded px-3 py-2" onClick={addToShoppingList} disabled={!lines.length}>
            Add to Shopping List
          </button>
        </div>
      </div>
    </div>
  );
}