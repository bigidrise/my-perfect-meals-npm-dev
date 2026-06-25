import { useState, useCallback } from "react";
import { Star, X } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useSavedMealsList, type SavedMealRow } from "@/hooks/useSavedMeals";
import { PillButton } from "@/components/ui/pill-button";
import { useStarchGuardPrecheck } from "@/hooks/useStarchGuardPrecheck";
import { StarchGuardIntercept } from "@/components/StarchGuardIntercept";

/** Small thumbnail that cleanly disappears on broken/expired URLs — no stock photo fallback. */
function FavThumbnail({ imageUrl, mealName }: { imageUrl: string; mealName: string }) {
  const [errored, setErrored] = useState(false);
  if (errored) return null;
  return (
    <div className="shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-zinc-800">
      <img
        src={imageUrl}
        alt={mealName}
        className="w-full h-full object-cover"
        onError={() => setErrored(true)}
      />
    </div>
  );
}

export type FavoriteCategory = "all" | "breakfast-style" | "mains" | "snacks" | "drinks";

const FILTER_TABS: { key: FavoriteCategory; label: string }[] = [
  { key: "all", label: "All" },
  { key: "breakfast-style", label: "Breakfast-style" },
  { key: "mains", label: "Mains" },
  { key: "snacks", label: "Snacks" },
  { key: "drinks", label: "Drinks" },
];

// Source type sets — exhaustive across all current builders
const DRINK_SOURCES = new Set([
  "pairings-ai", "wine-list-helper",
  "beverage-creator", "beverage",
  "athlete-beverage-creator", "athlete-beverage",
  "spirits-hub", "wine-pairing", "cocktail-creator",
]);
const SNACK_SOURCES = new Set([
  "dessert-creator", "dessert",
  "snack-creator", "snack",
  "craving-dessert", "craving-desserts",
]);
const SUSHI_SOURCES = new Set([
  "sushi-creator", "sushi",
]);

// Slot → category mapping (covers all slot values any builder might store)
const SLOT_TO_CATEGORY: Record<string, FavoriteCategory> = {
  breakfast: "breakfast-style",
  lunch: "mains",
  dinner: "mains",
  snack: "snacks",
  snacks: "snacks",
  dessert: "snacks",
  desserts: "snacks",
  beverage: "drinks",
  beverages: "drinks",
  drink: "drinks",
  drinks: "drinks",
};

const DRINK_KEYWORDS = [
  "shake", "smoothie", "latte", "juice", "coffee", "tea", "drink",
  "beverage", "cocktail", "wine", "beer", "agua fresca", "agua",
  "protein shake", "espresso", "mocktail", "matcha", "kombucha",
  "lemonade", "soda", "sparkling", "infusion", "elixir", "spritzer",
  "frappe", "cooler", "punch", "tonic", "horchata",
];
const SNACK_KEYWORDS = [
  "cookie", "brownie", "dessert", "cake", "ice cream", "pudding",
  "muffin", "donut", "pie", "pastry", "candy", "treat", "biscotti",
  "cheesecake", "tart", "macaroon", "gelato", "sorbet", "mousse",
  "truffle", "fudge", "cupcake", "cobbler", "parfait", "crepe",
];
const BREAKFAST_KEYWORDS = [
  "pancake", "waffle", "oatmeal", "cereal", "eggs", "omelette", "omelet",
  "scramble", "granola", "french toast", "bagel", "frittata", "quiche",
  "yogurt", "breakfast", "porridge", "acai bowl", "avocado toast",
  "hash", "benedict", "crepe", "biscuit and gravy",
];

/**
 * Classify a saved meal into a FavoriteCategory.
 *
 * Priority hierarchy (most → least reliable):
 *   1. Explicit mealCategory/category field stored on mealData
 *   2. mealData.slot (set by the weekly board and some builders)
 *   3. sourceType (expanded sets covering all current builders)
 *   4. Keyword matching on title + meal name
 *   5. Default → "mains"
 */
export function classifyFavorite(row: SavedMealRow): FavoriteCategory {
  const sourceType = (row.sourceType || "").toLowerCase();

  // 1. Explicit stored category on mealData
  const storedCat = (
    row.mealData?.mealCategory ||
    row.mealData?.category ||
    row.mealData?.mealType ||
    ""
  ).toLowerCase();
  if (storedCat) {
    if (storedCat.includes("drink") || storedCat.includes("beverage")) return "drinks";
    if (storedCat.includes("snack") || storedCat.includes("dessert")) return "snacks";
    if (storedCat.includes("breakfast")) return "breakfast-style";
    if (storedCat.includes("lunch") || storedCat.includes("dinner") || storedCat.includes("main")) return "mains";
  }

  // 2. mealData.slot
  const slot = (row.mealData?.slot || "").toLowerCase();
  if (slot && SLOT_TO_CATEGORY[slot]) return SLOT_TO_CATEGORY[slot];

  // 3. sourceType
  if (DRINK_SOURCES.has(sourceType)) return "drinks";
  if (SNACK_SOURCES.has(sourceType)) return "snacks";

  // 4. Keyword matching
  const title = (row.title || "").toLowerCase();
  const mealName = (row.mealData?.name || "").toLowerCase();
  const text = `${title} ${mealName}`;

  if (DRINK_KEYWORDS.some((k) => text.includes(k))) return "drinks";
  if (SNACK_KEYWORDS.some((k) => text.includes(k))) return "snacks";
  if (BREAKFAST_KEYWORDS.some((k) => text.includes(k))) return "breakfast-style";

  return "mains";
}

/** Map a saved meal's sourceType to the image slot type used for fallbacks. */
function toImageSlotType(sourceType: string): "beverage" | "dessert" | "snack" | "sushi" | "meal" {
  const s = sourceType.toLowerCase();
  if (DRINK_SOURCES.has(s) || s.includes("beverage") || s.includes("drink") || s.includes("wine") || s.includes("spirits")) return "beverage";
  if (SNACK_SOURCES.has(s) || s.includes("dessert")) return "dessert";
  if (s.includes("snack")) return "snack";
  if (SUSHI_SOURCES.has(s) || s.includes("sushi")) return "sushi";
  return "meal";
}

function extractIngredientTexts(mealData: any): string[] {
  const ingredients = mealData?.ingredients;
  if (!ingredients) return [mealData?.name || ""];
  if (Array.isArray(ingredients)) {
    return ingredients.map((ing: any) =>
      typeof ing === "string" ? ing : ing?.name || ing?.ingredient || ""
    ).filter(Boolean);
  }
  return [String(ingredients)];
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
  const [pendingFavorite, setPendingFavorite] = useState<SavedMealRow | null>(null);

  const {
    alert: starchAlert,
    checkStarch,
    clearAlert,
  } = useStarchGuardPrecheck();

  const filtered = (meals || []).filter((m) =>
    activeFilter === "all" ? true : classifyFavorite(m) === activeFilter
  );

  const handleUseThis = useCallback((row: SavedMealRow) => {
    const d = (row.mealData || {}) as any;
    const ingredientTexts = extractIngredientTexts(d);
    const ok = checkStarch(ingredientTexts);
    if (ok) {
      onSelect(row);
      onClose();
    } else {
      setPendingFavorite(row);
    }
  }, [checkStarch, onSelect, onClose]);

  const handleStarchDecision = useCallback((decision: string) => {
    if (decision === "continue_anyway") {
      if (pendingFavorite) {
        onSelect(pendingFavorite);
        onClose();
      }
    }
    clearAlert();
    setPendingFavorite(null);
  }, [pendingFavorite, onSelect, onClose, clearAlert]);

  return (
    <Drawer open={open} onOpenChange={(v) => { if (!v) { clearAlert(); setPendingFavorite(null); onClose(); } }}>
      <DrawerContent className="bg-zinc-950 border-zinc-800 flex flex-col max-h-[85vh]">
        <DrawerHeader className="border-b border-zinc-800 shrink-0">
          <div className="flex items-center justify-between">
            <DrawerTitle className="text-white flex items-center gap-2 text-base">
              <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
              {targetLabel ? `Favorites → ${targetLabel}` : "Pick a Favorite"}
            </DrawerTitle>
            <button
              onClick={() => { clearAlert(); setPendingFavorite(null); onClose(); }}
              className="text-white/50 hover:text-white p-1 rounded transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </DrawerHeader>

        {starchAlert.show && (
          <div className="px-4 pt-3 shrink-0">
            <StarchGuardIntercept
              alert={starchAlert}
              onDecision={handleStarchDecision}
              showContinueAnyway
              continueAnywayLabel="Use It Anyway"
              chooseAnotherLabel="Choose Another"
            />
          </div>
        )}

        {!starchAlert.show && (
          <>
            <div className="flex gap-2 overflow-x-auto px-4 py-3 border-b border-zinc-800 shrink-0 no-scrollbar">
              {FILTER_TABS.map((tab) => (
                <PillButton
                  key={tab.key}
                  onClick={() => setActiveFilter(tab.key)}
                  active={activeFilter === tab.key}
                  className="shrink-0"
                >
                  {tab.label}
                </PillButton>
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
                      <FavThumbnail imageUrl={d.imageUrl} mealName={row.title} />
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
                    <PillButton
                      onClick={() => handleUseThis(row)}
                      className="shrink-0"
                    >
                      Use This
                    </PillButton>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}
