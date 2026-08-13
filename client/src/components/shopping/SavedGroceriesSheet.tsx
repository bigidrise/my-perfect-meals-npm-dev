/**
 * SavedGroceriesSheet
 *
 * Bottom sheet that displays the user's persistent grocery preference library.
 * Items are grouped by category. Each row has an "Add to List" button and
 * a trash/unsave action.
 *
 * This is intentionally separate from the shopping list — saved groceries
 * are persistent preferences, not a temporary scoped list.
 */

import { useEffect, useState, useCallback } from "react";
import { queryClient } from "@/lib/queryClient";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Bookmark,
  ShoppingCart,
  Trash2,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useShoppingListStore } from "@/stores/shoppingListStore";
import { get, post, apiJSON } from "@/lib/api";
import { IngredientIntelligenceSheet } from "@/components/biometrics/IngredientIntelligenceSheet";
import type { IngredientScanResult } from "@/lib/photoIngredientCapture";

interface SavedGroceryItemMeta {
  alignmentGrade?: string;
  verdictLevel?: string;
  analysisMethod?: string;
  ingredients?: string[];
  resolvedFromDb?: boolean;
  resolvedName?: string;
}

interface SavedGroceryItem {
  id: string;
  productName: string;
  brand: string | null;
  barcode: string | null;
  category: string | null;
  source: string;
  nutritionJson: Record<string, any> | null;
  productMeta: SavedGroceryItemMeta | null;
  savedAt: string;
}

/**
 * Reconstruct a minimal IngredientScanResult from a saved grocery item so
 * IngredientIntelligenceSheet can display the badge and whatever analysis
 * data was persisted at save time.
 */
function buildResultFromSavedItem(item: SavedGroceryItem): IngredientScanResult {
  const meta = item.productMeta ?? {};
  const nutrition = item.nutritionJson ?? {};

  return {
    productName: item.brand ? `${item.brand} ${item.productName}` : item.productName,
    alignmentGrade: (meta.alignmentGrade as IngredientScanResult['alignmentGrade']) ?? 'B',
    verdictLevel: (meta.verdictLevel as IngredientScanResult['verdictLevel']) ?? 'caution',
    analysisMethod: (meta.analysisMethod as IngredientScanResult['analysisMethod']) ?? 'by_name',
    overallSummary: '',
    verdict: '',
    scoreCards: nutrition.scoreCards ?? {
      kids:        { verdict: 'neutral', reason: '' },
      adults:      { verdict: 'neutral', reason: '' },
      diet:        { verdict: 'neutral', reason: '' },
      fitnessGoal: { verdict: 'neutral', reason: '' },
    },
    outcomeCards: nutrition.outcomeCards ?? [],
    analysisProfile: [],
    betterAlternatives: [],
    ingredientDecoder: [],
    ingredientConsiderations: [],
    mayNotAlignWith: [],
    betterFor: [],
    householdNotes: [],
    educationalFooter: '',
    extractedIngredients: meta.ingredients ?? [],
    highRiskFindings: [],
    ocrConfidenceLow: false,
    fallbackUsed: false,
    isFrontLabel: false,
    productNameMissing: false,
    profileFactorsUsed: [],
    whatMattersMost: [],
    // Barcode DB resolution metadata — drives the badge in IngredientIntelligenceSheet
    barcode: item.barcode ?? undefined,
    resolvedFromDb: meta.resolvedFromDb,
    resolvedName: meta.resolvedName,
  };
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const CATEGORY_ORDER = [
  "Protein", "Produce", "Dairy & Eggs", "Grains & Packaged",
  "Pantry", "Sauces", "Snacks", "Drinks", "Frozen", "Other", "General",
];

const SOURCE_LABEL: Record<string, string> = {
  "grocery-coach": "Coach",
  "scanner": "Scanner",
  "manual": "Manual",
};

function groupByCategory(items: SavedGroceryItem[]): Record<string, SavedGroceryItem[]> {
  const groups: Record<string, SavedGroceryItem[]> = {};
  for (const item of items) {
    const cat = item.category ?? "General";
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(item);
  }
  return groups;
}

function sortedCategories(groups: Record<string, SavedGroceryItem[]>): [string, SavedGroceryItem[]][] {
  return Object.entries(groups).sort(([a], [b]) => {
    const ai = CATEGORY_ORDER.indexOf(a);
    const bi = CATEGORY_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

export default function SavedGroceriesSheet({ open, onOpenChange }: Props) {
  const { toast } = useToast();
  const hydrate = useShoppingListStore((s) => s.hydrate);

  const [items, setItems] = useState<SavedGroceryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [analysisItem, setAnalysisItem] = useState<SavedGroceryItem | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await get<{ items: SavedGroceryItem[] }>("/api/saved-groceries");
      setItems(data.items ?? []);
    } catch {
      setError("Could not load your saved groceries. Pull to refresh.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchItems();
      setAddedIds(new Set());
    }
  }, [open, fetchItems]);

  const handleAddToList = useCallback(async (item: SavedGroceryItem) => {
    setAddingId(item.id);
    try {
      const data = await post<{ name?: string }>(`/api/saved-groceries/${item.id}/add-to-list`);
      setAddedIds((prev) => new Set(Array.from(prev).concat(item.id)));
      await hydrate();
      toast({
        title: "Added to list!",
        description: data.name ?? item.productName,
      });
    } catch {
      toast({ title: "Couldn't add to list", description: "Please try again.", variant: "destructive" });
    } finally {
      setAddingId(null);
    }
  }, [hydrate, toast]);

  const handleRemove = useCallback(async (item: SavedGroceryItem) => {
    setRemovingId(item.id);
    try {
      await apiJSON(`/api/saved-groceries/${item.id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      queryClient.invalidateQueries({ queryKey: ['/api/saved-groceries'] });
      toast({ title: "Removed", description: `${item.productName} removed from saved groceries.` });
    } catch {
      toast({ title: "Couldn't remove item", description: "Please try again.", variant: "destructive" });
    } finally {
      setRemovingId(null);
    }
  }, [toast]);

  const toggleCollapse = (cat: string) =>
    setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }));

  const grouped = groupByCategory(items);
  const categories = sortedCategories(grouped);

  if (!open) return null;

  const mainSheet = createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop — hidden while analysis sheet is open so z-index doesn't fight */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onOpenChange(false)}
            style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
              backdropFilter: "blur(4px)", zIndex: 9998,
              visibility: analysisItem ? "hidden" : "visible",
            }}
          />

          {/* Sheet — hidden while analysis sheet is open so z-index doesn't fight */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            style={{
              position: "fixed", bottom: 0,
              left: "50%", transform: "translateX(-50%)",
              width: "100%", maxWidth: 896,
              maxHeight: "88vh", overflowY: "auto",
              background: "linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)",
              borderRadius: "20px 20px 0 0",
              padding: "0 0 env(safe-area-inset-bottom, 16px)",
              zIndex: 9999,
              boxShadow: "0 -8px 40px rgba(0,0,0,0.5)",
              visibility: analysisItem ? "hidden" : "visible",
            }}
          >
            {/* Drag handle */}
            <div style={{ display: "flex", justifyContent: "center", paddingTop: 12, paddingBottom: 4 }}>
              <div style={{ width: 40, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.2)" }} />
            </div>

            {/* Header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 20px 16px",
              borderBottom: "1px solid rgba(255,255,255,0.07)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Bookmark style={{ width: 20, height: 20, color: "#f97316" }} />
                <div>
                  <div style={{ color: "white", fontWeight: 700, fontSize: 17 }}>Saved Groceries</div>
                  <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>
                    {items.length} saved {items.length === 1 ? "item" : "items"} · remembered across sessions
                  </div>
                </div>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 8, padding: 8, cursor: "pointer" }}
              >
                <X style={{ width: 18, height: 18, color: "rgba(255,255,255,0.7)" }} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: "16px 20px", minHeight: 120 }}>
              {loading && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "40px 0", color: "rgba(255,255,255,0.5)" }}>
                  <Loader2 style={{ width: 20, height: 20, animation: "spin 1s linear infinite" }} />
                  Loading saved groceries…
                </div>
              )}

              {!loading && error && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 10,
                  background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
                  borderRadius: 10, padding: "12px 16px", color: "#ef4444",
                }}>
                  <AlertTriangle style={{ width: 16, height: 16, flexShrink: 0 }} />
                  {error}
                </div>
              )}

              {!loading && !error && items.length === 0 && (
                <div style={{ textAlign: "center", padding: "40px 20px" }}>
                  <Bookmark style={{ width: 36, height: 36, color: "rgba(255,255,255,0.2)", margin: "0 auto 12px" }} />
                  <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 15, marginBottom: 8 }}>
                    No saved groceries yet
                  </div>
                  <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, lineHeight: 1.5 }}>
                    When Grocery Coach recommends a brand you like,<br />
                    tap the bookmark icon to save it here.
                  </div>
                </div>
              )}

              {!loading && !error && categories.map(([cat, catItems]) => (
                <div key={cat} style={{ marginBottom: 20 }}>
                  {/* Category header */}
                  <button
                    onClick={() => toggleCollapse(cat)}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      width: "100%", background: "none", border: "none", cursor: "pointer",
                      padding: "6px 0", marginBottom: 8,
                    }}
                  >
                    <span style={{ color: "rgba(249,115,22,0.8)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      {cat} ({catItems.length})
                    </span>
                    {collapsed[cat]
                      ? <ChevronDown style={{ width: 14, height: 14, color: "rgba(255,255,255,0.4)" }} />
                      : <ChevronUp style={{ width: 14, height: 14, color: "rgba(255,255,255,0.4)" }} />
                    }
                  </button>

                  {/* Items */}
                  {!collapsed[cat] && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {catItems.map((item) => {
                        const isAdding = addingId === item.id;
                        const isAdded = addedIds.has(item.id);
                        const isRemoving = removingId === item.id;
                        const hasAnalysis = !!(item.productMeta?.alignmentGrade || item.productMeta?.resolvedFromDb !== undefined);

                        return (
                          <div
                            key={item.id}
                            style={{
                              display: "flex", alignItems: "center", gap: 10,
                              padding: "10px 12px", borderRadius: 10,
                              background: "rgba(255,255,255,0.04)",
                              border: "1px solid rgba(255,255,255,0.07)",
                            }}
                          >
                            {/* Tappable product info — opens analysis sheet if data exists */}
                            <button
                              onClick={() => hasAnalysis && setAnalysisItem(item)}
                              style={{
                                flex: 1, minWidth: 0, background: "none", border: "none",
                                cursor: hasAnalysis ? "pointer" : "default",
                                textAlign: "left", padding: 0,
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <div style={{ color: "white", fontWeight: 600, fontSize: 14, marginBottom: 2 }}>
                                  {item.productName}
                                </div>
                                {hasAnalysis && (
                                  <ChevronRight style={{ width: 13, height: 13, color: "rgba(249,115,22,0.6)", flexShrink: 0 }} />
                                )}
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                {item.brand && (
                                  <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>
                                    {item.brand}
                                  </span>
                                )}
                                <span style={{
                                  padding: "1px 6px", borderRadius: 999, fontSize: 10, fontWeight: 600,
                                  background: "rgba(249,115,22,0.12)", color: "rgba(249,115,22,0.7)",
                                  border: "1px solid rgba(249,115,22,0.2)",
                                }}>
                                  {SOURCE_LABEL[item.source] ?? item.source}
                                </span>
                                {item.productMeta?.resolvedFromDb === true && (
                                  <span style={{
                                    padding: "1px 6px", borderRadius: 999, fontSize: 10, fontWeight: 600,
                                    background: "rgba(16,185,129,0.12)", color: "rgba(16,185,129,0.8)",
                                    border: "1px solid rgba(16,185,129,0.2)",
                                  }}>
                                    ✓ DB
                                  </span>
                                )}
                              </div>
                            </button>

                            {/* Add to list */}
                            <button
                              onClick={() => handleAddToList(item)}
                              disabled={isAdding || isAdded}
                              style={{
                                display: "flex", alignItems: "center", justifyContent: "center",
                                gap: 4, padding: "6px 10px", borderRadius: 8, border: "none",
                                fontSize: 12, fontWeight: 600, cursor: isAdded ? "default" : "pointer",
                                background: isAdded ? "rgba(5,150,105,0.15)" : "rgba(234,88,12,0.15)",
                                color: isAdded ? "#34d399" : "#fb923c",
                                flexShrink: 0,
                              }}
                            >
                              {isAdding ? (
                                <Loader2 style={{ width: 13, height: 13, animation: "spin 1s linear infinite" }} />
                              ) : isAdded ? (
                                <><CheckCircle2 style={{ width: 13, height: 13 }} /> Added</>
                              ) : (
                                <><ShoppingCart style={{ width: 13, height: 13 }} /> Add</>
                              )}
                            </button>

                            {/* Unsave */}
                            <button
                              onClick={() => handleRemove(item)}
                              disabled={isRemoving}
                              style={{
                                display: "flex", alignItems: "center", justifyContent: "center",
                                width: 30, height: 30, borderRadius: 6, border: "none",
                                background: "rgba(239,68,68,0.08)", cursor: "pointer", flexShrink: 0,
                              }}
                            >
                              {isRemoving
                                ? <Loader2 style={{ width: 13, height: 13, color: "#ef4444", animation: "spin 1s linear infinite" }} />
                                : <Trash2 style={{ width: 13, height: 13, color: "rgba(239,68,68,0.6)" }} />
                              }
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );

  // Render the analysis sheet outside the main portal so it layers above it
  const analysisSheet = analysisItem ? (
    <IngredientIntelligenceSheet
      open={!!analysisItem}
      result={buildResultFromSavedItem(analysisItem)}
      onClose={() => setAnalysisItem(null)}
    />
  ) : null;

  return (
    <>
      {mainSheet}
      {analysisSheet}
    </>
  );
}
