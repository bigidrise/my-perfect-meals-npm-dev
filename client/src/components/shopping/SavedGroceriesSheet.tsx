/**
 * SavedGroceriesSheet
 *
 * Bottom sheet that displays the user's persistent grocery preference library.
 * Searchable product rows represent shopping intent, not safety approval.
 * Saved analysis is separate; the server retains authority over list additions.
 *
 * This is intentionally separate from the shopping list — saved groceries
 * are persistent preferences, not a temporary scoped list.
 */

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { restoreSavedAnalysis, savedAnalysisKind, savedProductStatus } from "@/lib/savedGroceryAnalysis";
import { queryClient } from "@/lib/queryClient";
import { groceryProductLabel } from "@/lib/savedGroceryRecommendation";
import type { SavedRecommendationMetadata } from "@/lib/savedGroceryRecommendation";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Bookmark,
  Trash2,
  Loader2,
  AlertTriangle,
  Search,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useShoppingListStore } from "@/stores/shoppingListStore";
import { get, post, apiJSON } from "@/lib/api";
import { IngredientIntelligenceSheet } from "@/components/biometrics/IngredientIntelligenceSheet";
import type { IngredientScanResult } from "@/lib/photoIngredientCapture";
import { PillButton } from "@/components/ui/pill-button";

interface SavedGroceryItemMeta extends SavedRecommendationMetadata {
  [key: string]: any;
  alignmentGrade?: string;
  verdictLevel?: string;
  analysisMethod?: string;
  ingredients?: string[];
  resolvedFromDb?: boolean;
  resolvedName?: string;
}

export interface SavedGroceryItem {
  evidenceRevision?: string;
  id: string;
  productName: string;
  brand: string | null;
  barcode: string | null;
  productKey: string;
  category: string | null;
  source: string;
  nutritionJson: Record<string, any> | null;
  productMeta: SavedGroceryItemMeta | null;
  savedAt: string;
  compliance: {
    category?: "evidence_missing" | "incompatible" | "profile_unavailable";
    status: "approved" | "blocked";
    reason: string | null;
  };
}

/**
 * Reconstruct a minimal IngredientScanResult from a saved grocery item so
 * IngredientIntelligenceSheet can display the badge and whatever analysis
 * data was persisted at save time.
 */
export function buildResultFromSavedItem(item: SavedGroceryItem): IngredientScanResult {
  const meta = item.productMeta ?? {};
  const nutrition = item.nutritionJson ?? {};

  return {
    productName: groceryProductLabel(item),
    alignmentGrade: meta.alignmentGrade as IngredientScanResult['alignmentGrade'],
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
    ...restoreSavedAnalysis(item),
  };
}

interface Props {
  onVerifyProduct?: (item: SavedGroceryItem) => void;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

function itemDisplayName(item: SavedGroceryItem): string {
  return groceryProductLabel(item);
}

function itemPackageSize(item: SavedGroceryItem): string {
  // Package size is not serving size. Never infer a package from nutrition data.
  const size = item.productMeta?.packageSize ?? item.nutritionJson?.packageSize;
  return typeof size === "string" ? size.trim() : "";
}

export default function SavedGroceriesSheet({ open, onOpenChange, onVerifyProduct }: Props) {
  const { user } = useAuth();
  const owner = user?.id ?? null;
  const session = useRef({ owner });
  if (session.current.owner !== owner) session.current = { owner };
  const [loadedOwner, setLoadedOwner] = useState<string | null>(null);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const { toast } = useToast();
  const hydrate = useShoppingListStore((s) => s.hydrate);
  const shoppingItems = useShoppingListStore((s) => s.items);

  const [items, setItems] = useState<SavedGroceryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bulkAdding, setBulkAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [analysisItem, setAnalysisItem] = useState<SavedGroceryItem | null>(null);
  useEffect(() => {
    setAnalysisItem(null); setHistoryIndex(-1);
    setSelectedIds(new Set());
    setBulkAdding(false);
    setRemovingId(null);
    setLoadedOwner(null); setItems([]);
  }, [owner]);

  const fetchItems = useCallback(async () => {
    if (!owner) return;
    const started = session.current;
    setLoading(true);
    setError(null);
    try {
      const data = await get<{ items: SavedGroceryItem[] }>("/api/saved-groceries");
      if (started !== session.current) return;
      setItems(data.items ?? []);
      setSelectedIds(previous => new Set(
        Array.from(previous).filter(id => data.items?.some(
          item => item.id === id,
        )),
      ));
      setLoadedOwner(owner);
    } catch {
      if (started === session.current) setError("Could not load your saved groceries. Pull to refresh.");
    } finally {
      if (started === session.current) setLoading(false);
    }
  }, [owner]);

  useEffect(() => {
    if (open) {
      fetchItems();
      hydrate();
      setSelectedIds(new Set());
    }
  }, [open, fetchItems, hydrate]);

  const visibleItems = useMemo(() => {
    const query = searchTerm.trim().toLocaleLowerCase();
    return (loadedOwner === owner ? items : []).filter((item) => {
      if (!query) return true;
      return `${itemDisplayName(item)} ${itemPackageSize(item)}`.toLocaleLowerCase().includes(query);
    });
  }, [items, searchTerm, loadedOwner, owner]);

  const isItemOnList = useCallback((item: SavedGroceryItem) => {
    return shoppingItems.some(
      (shoppingItem) =>
        !shoppingItem.isChecked &&
        !!shoppingItem.productKey &&
        shoppingItem.productKey === item.productKey,
    );
  }, [shoppingItems]);

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleAddMany = useCallback(async (ids: string[]) => {
    const started = session.current;
    const uniqueIds = Array.from(new Set(ids)).filter(id =>
      loadedOwner === owner && items.some(item =>
        item.id === id,
      ),
    );
    if (uniqueIds.length === 0 || bulkAdding) return;
    setBulkAdding(true);
    try {
      const data = await post<{
        items?: Array<{
          id: string;
          status: "added" | "already_on_list" | "restored" | "blocked";
          reason?: string | null;
        }>;
        addedCount?: number;
        restoredCount?: number;
        alreadyOnListCount?: number;
        blockedCount?: number;
      }>("/api/saved-groceries/add-to-list", { ids: uniqueIds });
      if (started !== session.current) return;
      setSelectedIds(new Set());
      await hydrate();
      if (started !== session.current) return;
      const added = data.addedCount ?? 0;
      const restored = data.restoredCount ?? 0;
      const alreadyOnList = data.alreadyOnListCount ?? 0;
      const blocked = data.blockedCount ?? 0;
      const details = [
        added > 0 ? `${added} added` : "",
        restored > 0 ? `${restored} restored` : "",
        alreadyOnList > 0 ? `${alreadyOnList} already on list` : "",
        blocked > 0 ? `${blocked} not added` : "",
      ].filter(Boolean).join(" · ");
      const rejected = (data.items ?? []).filter(item => item.status === "blocked");
      const rejectionDetails = rejected.map(result => {
        const product = items.find(item => item.id === result.id);
        return `${product ? itemDisplayName(product) : "Selected product"}: ${result.reason || "The current server rules did not allow this addition."}`;
      }).join(" ");
      toast({
        title: blocked > 0
          ? "Some products were not added"
          : uniqueIds.length === 1
            ? "Added to list"
            : "Saved groceries updated",
        description: [details, rejectionDetails].filter(Boolean).join(". ") || "Your shopping list is up to date.",
        variant: blocked > 0 && added + restored + alreadyOnList === 0
          ? "destructive"
          : undefined,
      });
    } catch {
      if (started !== session.current) return;
      toast({
        title: "Couldn't add to list",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      if (started === session.current) setBulkAdding(false);
    }
  }, [hydrate, toast, items, loadedOwner, owner, bulkAdding]);

  const handleAddToList = useCallback(async (item: SavedGroceryItem) => {
    const started = session.current;
    if (isItemOnList(item)) return false;
    try {
      const data = await post<{
        name?: string;
        status?: "added" | "already_on_list" | "restored" | "blocked";
        reason?: string | null;
      }>(`/api/saved-groceries/${item.id}/add-to-list`);
      if (started !== session.current) return false;
      if (data.status === "blocked") {
        toast({
          title: "Saved, but not added",
          description: data.reason ?? "This product does not fit your current profile.",
          variant: "destructive",
        });
        return false;
      }
      await hydrate();
      toast({
        title: data.status === "already_on_list" ? "Already on list" : "Added to list!",
        description: data.name ?? itemDisplayName(item),
      });
      return true;
    } catch {
      toast({ title: "Couldn't add to list", description: "Please try again.", variant: "destructive" });
      return false;
    }
  }, [hydrate, toast]);

  const handleRemove = useCallback(async (item: SavedGroceryItem) => {
    const started = session.current;
    setRemovingId(item.id);
    try {
      await apiJSON(`/api/saved-groceries/${item.id}`, { method: "DELETE" });
      if (started !== session.current) return;
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['/api/saved-groceries'] });
      toast({ title: "Removed", description: `${item.productName} removed from saved groceries.` });
    } catch {
      if (started !== session.current) return;
      toast({ title: "Couldn't remove item", description: "Please try again.", variant: "destructive" });
    } finally {
      if (started === session.current) setRemovingId(null);
    }
  }, [toast]);

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
              left: 0, right: 0, margin: "0 auto",
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
              {!loading && !error && items.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 8,
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 10, padding: "8px 10px",
                  }}>
                    <Search style={{ width: 16, height: 16, color: "rgba(255,255,255,0.45)", flexShrink: 0 }} />
                    <input
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Search saved groceries"
                      aria-label="Search saved groceries"
                      style={{
                        width: "100%", background: "transparent", border: "none", outline: "none",
                        color: "white", fontSize: 13,
                      }}
                    />
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 12 }}>
                        {visibleItems.length} shown · {selectedIds.size} selected
                      </div>
                      <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, marginTop: 2 }}>
                        Choose the products you want to buy. Selections stay selected when you search.
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <PillButton
                        type="button"
                        variant="sky"
                        active={selectedIds.size > 0}
                        disabled={selectedIds.size === 0 || bulkAdding}
                        onClick={() => handleAddMany(Array.from(selectedIds))}
                      >
                        {bulkAdding ? "Adding…" : `Add Selected to Shopping List${selectedIds.size ? ` (${selectedIds.size})` : ""}`}
                      </PillButton>
                    </div>
                  </div>
                </div>
              )}

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

              {!loading && !error && items.length > 0 && visibleItems.length === 0 && (
                <div style={{ textAlign: "center", padding: "28px 20px", color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
                  No saved groceries match your search.
                </div>
              )}

              {!loading && !error && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {visibleItems.map((item) => {
                        const isSelected = selectedIds.has(item.id);
                        const isRemoving = removingId === item.id;

                        return (
                          <div
                            key={item.id}
                            style={{
                               display: "flex",
                               alignItems: "center",
                               gap: 4,
                              padding: "8px 12px", borderRadius: 10,
                              background: "rgba(255,255,255,0.04)",
                              border: "1px solid rgba(255,255,255,0.07)",
                            }}
                          >
                              <label style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, flexShrink: 0, cursor: "pointer" }}>
                                <input type="checkbox" aria-label={`Select ${itemDisplayName(item)}${itemPackageSize(item) ? ` (${itemPackageSize(item)})` : ""}`}
                                  style={{ width: 22, height: 22, accentColor: "#38bdf8", cursor: "pointer" }}
                                  checked={isSelected} disabled={bulkAdding}
                                  onChange={() => toggleSelected(item.id)} />
                              </label>

                            <div
                              className="line-clamp-2"
                              title={`${itemDisplayName(item)}${itemPackageSize(item) ? ` (${itemPackageSize(item)})` : ""}`}
                              style={{
                                flex: "1 1 0", minWidth: 0, textAlign: "left",
                                color: "white",
                                fontWeight: 600,
                                fontSize: 14,
                                lineHeight: 1.35,
                                overflowWrap: "anywhere",
                                overflow: "hidden",
                              }}
                            >
                              {itemDisplayName(item)}{itemPackageSize(item) ? ` (${itemPackageSize(item)})` : ""}
                            </div>

                            <button
                              type="button"
                              onClick={() => { setHistoryIndex(-1); setAnalysisItem(item); }}
                              aria-label={`View Analysis: ${itemDisplayName(item)}`}
                              className="hover:brightness-125 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
                              style={{
                                color: "#7dd3fc", background: "rgba(56,189,248,0.12)",
                                border: "1px solid rgba(56,189,248,0.45)", borderRadius: 8,
                                fontSize: 12, fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 3,
                                padding: "0 4px", minWidth: 52, height: 44, flexShrink: 0, cursor: "pointer",
                              }}
                            >
                              Analysis
                            </button>

                            {/* Unsave */}
                            <button
                              type="button"
                              onClick={() => handleRemove(item)}
                              disabled={isRemoving}
                              aria-label={`Remove ${itemDisplayName(item)} from saved groceries`}
                              title="Remove from saved groceries"
                              style={{
                                display: "flex", alignItems: "center", justifyContent: "center",
                                gap: 4, minWidth: 44, height: 44, padding: "0 6px", borderRadius: 8,
                                border: "1px solid rgba(239,68,68,0.18)",
                                background: "rgba(239,68,68,0.08)", color: "rgba(239,68,68,0.8)", fontSize: 11, cursor: "pointer", flexShrink: 0,
                              }}
                            >
                              {isRemoving
                                ? <Loader2 style={{ width: 13, height: 13, color: "#ef4444", animation: "spin 1s linear infinite" }} />
                                : <Trash2 style={{ width: 13, height: 13, color: "rgba(239,68,68,0.7)" }} />
                              }
                              Delete
                            </button>
                          </div>
                        );
                      })}
                    </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );

  // Render the analysis sheet outside the main portal so it layers above it
  const historical = historyIndex >= 0 ? analysisItem?.productMeta?.evidenceHistory?.[historyIndex] : null;
  const displayedItem = historical && analysisItem ? { ...analysisItem, productMeta: historical.productMeta, nutritionJson: historical.nutritionJson } : analysisItem;
  const storedScores = displayedItem?.productMeta?.analysisSnapshot?.scoreCards
    ?? displayedItem?.productMeta?.scoreCards ?? displayedItem?.nutritionJson?.scoreCards;
  const analysisSheet = analysisItem && loadedOwner === owner ? (
    <IngredientIntelligenceSheet
      key={`${analysisItem.id}:${historyIndex}`}
      open={!!analysisItem}
      hideSaveAction
      savedAnalysisKind={savedAnalysisKind(displayedItem!)}
      hideLegacyScoreCards={!["kids", "adults", "diet", "fitnessGoal"].some(key => storedScores?.[key]?.verdict)}
      result={buildResultFromSavedItem(displayedItem!)}
      savedContext={<section className="rounded-xl border border-white/20 p-3 my-3 text-sm space-y-2">
        <p>{savedAnalysisKind(displayedItem!) === "full" ? "Analysis saved" : savedAnalysisKind(displayedItem!) === "recommendation" ? "Recommendation saved" : "Saved product — original analysis may be unavailable"}</p>
        {itemPackageSize(displayedItem!) && <p>Package: {itemPackageSize(displayedItem!)}</p>}
        <p>{savedProductStatus(analysisItem)}</p>
        {analysisItem.compliance.reason && <p>{analysisItem.compliance.reason}</p>}
        <p>Saving analysis does not verify the current label. Historical analysis is not current safety approval.</p>
        {/certif/i.test(analysisItem.compliance.reason || "") && <p>An ingredient photo alone cannot establish independent certification.</p>}
        {!!analysisItem.productMeta?.evidenceHistory?.length && <label>Evidence version{" "}
          <select aria-label="Evidence version" className="bg-slate-800 p-2" value={historyIndex} onChange={e => setHistoryIndex(Number(e.target.value))}>
            <option value={-1}>Current saved analysis</option>
            {analysisItem.productMeta.evidenceHistory.map((_: unknown, i: number) => <option key={i} value={i}>Previous evidence {i + 1}</option>)}
          </select>
        </label>}
        {onVerifyProduct && <button className="border border-orange-400 rounded-lg p-2" onClick={() => {
          setAnalysisItem(null); onOpenChange(false); onVerifyProduct(analysisItem);
        }}>Scan current ingredient label</button>}
        {analysisItem.compliance.category === "profile_unavailable" && <button className="border rounded-lg p-2" onClick={async () => {
          await fetchItems(); setAnalysisItem(null);
        }}>Retry current profile check</button>}
      </section>}
      onAddProduct={analysisItem.compliance.status === "approved" && historyIndex === -1 ? () => handleAddToList(analysisItem) : undefined}
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
