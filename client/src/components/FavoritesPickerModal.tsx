import { useState } from "react";
import { Star, X } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useSavedMealsList, type SavedMealRow } from "@/hooks/useSavedMeals";
import { Button } from "@/components/ui/button";
import { MealImageSlot } from "@/components/ui/MealImageSlot";

export type FavoriteCategory = "all" | "breakfast-style" | "mains" | "snacks" | "drinks";

const FILTER_TABS: { key: FavoriteCategory; label: string }[] = [
  { key: "all", label: "All" },
  { key: "breakfast-style", label: "Breakfast-style" },
  { key: "mains", label: "Mains" },
  { key: "snacks", label: "Snacks" },
  { key: "drinks", label: "Drinks" },
];

const DRINK_SOURCES = ["pairings-ai", "wine-list-helper", "beverage-creator"];
const SNACK_SOURCES = ["dessert-creator"];

const DRINK_KEYWORDS = [
  "shake", "smoothie", "latte", "juice", "coffee", "tea", "drink",
  "beverage", "cocktail", "wine", "beer", "agua", "agua fresca",
  "protein shake", "espresso", "mocktail", "matcha", "kombucha",
];
const SNACK_KEYWORDS = [
  "cookie", "brownie", "dessert", "cake", "ice cream", "pudding",
  "muffin", "donut", "pie", "pastry", "candy", "treat", "biscotti",
  "cheesecake", "tart", "macaroon",
];
const BREAKFAST_KEYWORDS = [
  "pancake", "waffle", "oatmeal", "cereal", "eggs", "omelette", "omelet",
  "scramble", "granola", "french toast", "bagel", "frittata", "quiche",
  "yogurt", "breakfast", "porridge", "acai bowl", "avocado toast",
];

export function classifyFavorite(row: SavedMealRow): FavoriteCategory {
  const title = (row.title || "").toLowerCase();
  const mealName = (row.mealData?.name || "").toLowerCase();
  const text = `${title} ${mealName}`;

  if (DRINK_SOURCES.some((s) => row.sourceType.includes(s))) return "drinks";
  if (DRINK_KEYWORDS.some((k) => text.includes(k))) return "drinks";

  if (SNACK_SOURCES.includes(row.sourceType)) return "snacks";
  if (row.mealData?.slot === "snacks") return "snacks";
  if (SNACK_KEYWORDS.some((k) => text.includes(k))) return "snacks";

  if (row.mealData?.slot === "breakfast") return "breakfast-style";
  if (BREAKFAST_KEYWORDS.some((k) => text.includes(k))) return "breakfast-style";

  return "mains";
}

interface FavoritesPickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (meal: SavedMealRow) => void;
  targetLabel?: string;
}

export function FavoritesPickerModal({
  open,
  onClose,
  onSelect,
  targetLabel,
}: FavoritesPickerModalProps) {
  const { data: meals, isLoading } = useSavedMealsList();
  const [activeFilter, setActiveFilter] = useState<FavoriteCategory>("all");

  const filtered = (meals || []).filter((m) =>
    activeFilter === "all" ? true : classifyFavorite(m) === activeFilter
  );

  return (
    <Drawer open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DrawerContent className="bg-zinc-950 border-zinc-800 flex flex-col max-h-[85vh]">
        <DrawerHeader className="border-b border-zinc-800 shrink-0">
          <div className="flex items-center justify-between">
            <DrawerTitle className="text-white flex items-center gap-2 text-base">
              <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
              {targetLabel ? `Favorites → ${targetLabel}` : "Pick a Favorite"}
            </DrawerTitle>
            <button
              onClick={onClose}
              className="text-white/50 hover:text-white p-1 rounded transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </DrawerHeader>

        <div className="flex gap-2 overflow-x-auto px-4 py-3 border-b border-zinc-800 shrink-0 no-scrollbar">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                activeFilter === tab.key
                  ? "bg-yellow-400/20 text-yellow-300 border border-yellow-400/40"
                  : "bg-zinc-800 text-white/60 border border-zinc-700 hover:bg-zinc-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-3">
          {isLoading && (
            <p className="text-center text-white/50 text-sm py-10">Loading favorites…</p>
          )}

          {!isLoading && filtered.length === 0 && (
            <div className="text-center text-white/40 py-14">
              <Star className="h-10 w-10 mx-auto mb-3 text-white/15" />
              <p className="font-medium text-sm">No favorites here yet</p>
              <p className="text-xs mt-1 text-white/25">
                Tap ♥ on any meal to save it
              </p>
            </div>
          )}

          {filtered.map((row) => {
            const d = (row.mealData || {}) as any;
            const cal = Math.round(d?.nutrition?.calories || d?.calories || 0);
            const prot = Math.round(d?.nutrition?.protein || d?.protein || 0);

            return (
              <div
                key={row.id}
                className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3"
              >
                {d?.imageUrl && (
                  <div className="shrink-0 w-14 h-14 rounded-lg overflow-hidden">
                    <MealImageSlot
                      imageUrl={d.imageUrl}
                      mealName={row.title}
                      size="sm"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{row.title}</p>
                  {(cal > 0 || prot > 0) && (
                    <p className="text-white/45 text-xs mt-0.5">
                      {cal > 0 ? `${cal} cal` : ""}
                      {cal > 0 && prot > 0 ? " · " : ""}
                      {prot > 0 ? `${prot}g protein` : ""}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  onClick={() => { onSelect(row); onClose(); }}
                  className="shrink-0 bg-yellow-500/15 text-yellow-300 border border-yellow-400/30 hover:bg-yellow-500/25 text-xs px-3"
                >
                  Use This
                </Button>
              </div>
            );
          })}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
