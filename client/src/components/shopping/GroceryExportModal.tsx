// client/src/components/shopping/GroceryExportModal.tsx
// Grocery export modal — one item per retailer search, with sanitization.
// Replaces the old "open one mega-query URL" approach.

import { useState, useMemo } from "react";
import { ExternalLink, X, ShoppingCart, Check } from "lucide-react";
import { GROCERY_RETAILERS, GroceryRetailerId, normalizeForRetailerSearch } from "@/lib/groceryRetailers";
import { ShoppingListItem } from "@/stores/shoppingListStore";
import { formatQuantity } from "@/lib/formatQuantity";

// ── Sanitization ─────────────────────────────────────────────────────────────

const PLACEHOLDER_PATTERN = /^(scanned item|item|unknown item|grocery item|scan|ingredient|food item|add item|new item)$/i;

function sanitizeExportItems(items: ShoppingListItem[]): ShoppingListItem[] {
  // 1. Only unchecked items
  const unchecked = items.filter((i) => !i.isChecked);

  // 2. Remove placeholder names and very short/empty names
  const valid = unchecked.filter(
    (i) =>
      i.name &&
      i.name.trim().length > 1 &&
      !PLACEHOLDER_PATTERN.test(i.name.trim())
  );

  // 3. Deduplicate by normalizedName (keep highest-quantity entry)
  const map = new Map<string, ShoppingListItem>();
  for (const item of valid) {
    const key = (item.normalizedName || item.name).toLowerCase().trim();
    const existing = map.get(key);
    if (!existing || item.quantity > existing.quantity) {
      map.set(key, item);
    }
  }

  return Array.from(map.values());
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface GroceryExportModalProps {
  items: ShoppingListItem[];
  defaultRetailerId?: GroceryRetailerId;
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function GroceryExportModal({
  items,
  defaultRetailerId = "walmart",
  onClose,
}: GroceryExportModalProps) {
  const [activeRetailerId, setActiveRetailerId] =
    useState<GroceryRetailerId>(defaultRetailerId);
  const [opened, setOpened] = useState<Set<string>>(new Set());

  const sanitized = useMemo(() => sanitizeExportItems(items), [items]);

  const activeRetailer = GROCERY_RETAILERS.find((r) => r.id === activeRetailerId)!;

  function handleItemClick(item: ShoppingListItem) {
    setOpened((prev) => new Set([...prev, item.id]));
  }

  const openedCount = sanitized.filter((i) => opened.has(i.id)).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg bg-gradient-to-b from-black/95 via-gray-900 to-black border border-orange-500/20 rounded-t-3xl shadow-2xl flex flex-col max-h-[88vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-orange-400" />
            <div>
              <div className="text-white font-bold text-base leading-tight">
                Shop Online
              </div>
              <div className="text-white/50 text-xs mt-0.5">
                {sanitized.length} item{sanitized.length !== 1 ? "s" : ""} ready
                {openedCount > 0 && (
                  <span className="text-orange-400 ml-1">· {openedCount} searched</span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Retailer tabs — single scrollable row, never wraps */}
        <div className="px-4 pb-3 flex gap-2 overflow-x-auto flex-shrink-0 scrollbar-hide">
          {GROCERY_RETAILERS.map((retailer) => (
            <button
              key={retailer.id}
              onClick={() => setActiveRetailerId(retailer.id)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all whitespace-nowrap flex-shrink-0 ${
                activeRetailerId === retailer.id
                  ? "bg-orange-600 border-orange-500 text-white"
                  : "bg-white/10 border-white/15 text-white/60"
              }`}
            >
              {retailer.name}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="h-px bg-white/10 mx-4 flex-shrink-0" />

        {/* How it works hint */}
        <div className="px-5 py-2.5 flex-shrink-0">
          <p className="text-white/40 text-[11px]">
            Tap each item to search on {activeRetailer.name} — one at a time for accurate results.
          </p>
        </div>

        {/* Item list */}
        <div className="overflow-y-auto flex-1 px-4 pb-4 space-y-1.5">
          {sanitized.length === 0 ? (
            <div className="text-center py-10 text-white/40 text-sm">
              No items to export. Add items to your list first.
            </div>
          ) : (
            sanitized.map((item) => {
              const url = activeRetailer.buildItemUrl(item.name);
              const wasOpened = opened.has(item.id);
              const searchName = normalizeForRetailerSearch(item.name);
              const qty = item.quantity && item.unit
                ? formatQuantity(item.quantity, item.unit)
                : item.quantity
                  ? String(item.quantity)
                  : null;

              return (
                <a
                  key={item.id}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => handleItemClick(item)}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 border transition-all ${
                    wasOpened
                      ? "bg-white/5 border-white/10 opacity-70"
                      : "bg-white/10 border-white/15 active:bg-orange-600/20"
                  }`}
                >
                  {/* Status icon */}
                  <div
                    className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center ${
                      wasOpened ? "bg-orange-600/40" : "bg-white/10"
                    }`}
                  >
                    {wasOpened ? (
                      <Check className="h-3.5 w-3.5 text-orange-400" />
                    ) : (
                      <ExternalLink className="h-3 w-3 text-white/40" />
                    )}
                  </div>

                  {/* Item info */}
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium leading-tight truncate ${wasOpened ? "text-white/50" : "text-white"}`}>
                      {item.name}
                    </div>
                    {searchName !== item.name.toLowerCase().trim() && (
                      <div className="text-white/35 text-[10px] mt-0.5 truncate">
                        searching: "{searchName}"
                      </div>
                    )}
                    {qty && (
                      <div className="text-white/40 text-xs mt-0.5">{qty}</div>
                    )}
                  </div>

                  {/* Category badge */}
                  {item.category && item.category !== "Other" && (
                    <div className="text-white/30 text-[10px] bg-white/5 px-2 py-0.5 rounded-full flex-shrink-0">
                      {item.category}
                    </div>
                  )}
                </a>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/10 flex-shrink-0">
          <p className="text-white/25 text-[10px] leading-tight text-center">
            Search results open on the retailer's site. My Perfect Meals does not process payments or handle delivery.
          </p>
        </div>
      </div>
    </div>
  );
}
