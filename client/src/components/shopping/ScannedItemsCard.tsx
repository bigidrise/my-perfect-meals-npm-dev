import { useState, useEffect, useRef } from "react";
import { Trash2, Camera, Pencil, Check } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  readOtherItems,
  deleteOtherItem,
  toggleOtherItemChecked,
  clearCheckedOtherItems,
  updateOtherItem,
  type OtherItem,
} from "@/stores/otherItemsStore";

export default function ScannedItemsCard() {
  const [items, setItems] = useState<OtherItem[]>(() =>
    readOtherItems().items.filter((i) => i.source === "scanned")
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onUpdate = () =>
      setItems(readOtherItems().items.filter((i) => i.source === "scanned"));
    window.addEventListener("other:items:updated", onUpdate);
    return () => window.removeEventListener("other:items:updated", onUpdate);
  }, []);

  function startEdit(item: OtherItem) {
    setEditingId(item.id);
    setEditValue(item.name);
    setTimeout(() => editInputRef.current?.focus(), 50);
  }

  function commitEdit(id: string) {
    const trimmed = editValue.trim();
    if (trimmed) updateOtherItem(id, { name: trimmed });
    setEditingId(null);
  }

  if (items.length === 0) return null;

  const unchecked = items.filter((i) => !i.checked);
  const checked = items.filter((i) => i.checked);

  return (
    <div className="rounded-2xl border border-cyan-500/25 bg-black/60 text-white p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Camera className="h-5 w-5 text-cyan-400" />
          <h3 className="text-base font-semibold">Scanned Items</h3>
          <span className="text-xs text-white/40 ml-1">
            {unchecked.length} item{unchecked.length !== 1 ? "s" : ""}
          </span>
        </div>
        {checked.length > 0 && (
          <button
            onClick={() => clearCheckedOtherItems()}
            className="text-[11px] text-white/40 active:text-white/70 transition-colors"
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
              {editingId === item.id ? (
                <input
                  ref={editInputRef}
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => commitEdit(item.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitEdit(item.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className="w-full bg-black/60 border border-orange-500/40 rounded-lg px-2 py-1 text-sm text-white focus:outline-none caret-white"
                />
              ) : (
                <span
                  className={`text-sm font-medium ${
                    item.checked ? "line-through text-white/40" : "text-white"
                  }`}
                >
                  {item.name}
                </span>
              )}
            </div>

            {editingId === item.id ? (
              <button
                onClick={() => commitEdit(item.id)}
                className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-orange-500/20 border border-orange-500/30 text-orange-400"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={() => startEdit(item)}
                className="shrink-0 text-white/25 active:text-white/60 transition-colors p-1"
                aria-label="Rename item"
              >
                <Pencil className="w-3 h-3" />
              </button>
            )}

            <button
              onClick={() => deleteOtherItem(item.id)}
              className="shrink-0 text-white/20 active:text-red-400 transition-colors p-1"
              aria-label="Remove item"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-white/25 mt-3 text-center leading-relaxed">
        Tap the pencil to rename any scanned item.
      </p>
    </div>
  );
}
