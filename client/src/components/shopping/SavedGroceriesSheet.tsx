/**
 * SavedGroceriesSheet
 *
 * Bottom sheet that displays the user's persistent grocery preference library.
 * Searchable product rows support eligible selection, saved analysis,
 * current-label verification, and an explicit trash/unsave action.
 *
 * This is intentionally separate from the shopping list — saved groceries
 * are persistent preferences, not a temporary scoped list.
 */

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { restoreSavedAnalysis, savedProductStatus } from "@/lib/savedGroceryAnalysis";
import { queryClient } from "@/lib/queryClient";
import { groceryProductLabel, savedRecommendationDetails } from "@/lib/savedGroceryRecommendation";
import type { SavedRecommendationMetadata } from "@/lib/savedGroceryRecommendation";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Bookmark,
  ShoppingCart,
  Trash2,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
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
    ...savedRecommendationDetails(meta),
    ...restoreSavedAnalysis(item),
  };
}

interface Props {
  onVerifyProduct?: (item: SavedGroceryItem) => void;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const SOURCE_LABEL: Record<string, string> = {
  "grocery-coach": "Coach",
  "scanner": "Scanner",
  "manual": "Manual",
};

function itemDisplayName(item: SavedGroceryItem): string {
  return groceryProductLabel(item);
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
  const [addingId, setAddingId] = useState<string | null>(null);
  const [bulkAdding, setBulkAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [analysisItem, setAnalysisItem] = useState<SavedGroceryItem | null>(null);
  useEffect(() => {
    setAnalysisItem(null); setHistoryIndex(-1);
    setSelectedIds(new Set()); setAddedIds(new Set());
    setBulkAdding(false);
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
          item => item.id === id && item.compliance.status === "approved",
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
      setAddedIds(new Set());
      setSelectedIds(new Set());
    }
  }, [open, fetchItems, hydrate]);

  const visibleItems = useMemo(() => {
    const query = searchTerm.trim().toLocaleLowerCase();
    return (loadedOwner === owner ? items : []).filter((item) => {
      if (!query) return true;
      return itemDisplayName(item).toLocaleLowerCase().includes(query);
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
        item.id === id && item.compliance.status === "approved",
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
      const successfulIds = (data.items ?? [])
        .filter((item) => item.status !== "blocked")
        .map((item) => item.id);
      setAddedIds((previous) => new Set([...Array.from(previous), ...successfulIds]));
      setSelectedIds(new Set());
      // A profile may have changed since this sheet loaded. Refresh its
      // authoritative reasons/eligibility rather than leaving rejected rows selectable.
      if ((data.blockedCount ?? 0) > 0) await fetchItems();
      if (started !== session.current) return;
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
        blocked > 0 ? `${blocked} blocked by current profile` : "",
      ].filter(Boolean).join(" · ");
      toast({
        title: blocked > 0
          ? "Some saved products need review"
          : uniqueIds.length === 1
            ? "Added to list"
            : "Saved groceries updated",
        description: details || "Your shopping list is up to date.",
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
  }, [hydrate, toast, items, loadedOwner, owner, bulkAdding, fetchItems]);

  const handleAddToList = useCallback(async (item: SavedGroceryItem) => {
    const started = session.current;
    if (isItemOnList(item)) return false;
    setAddingId(item.id);
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
      if (data.status !== "already_on_list") {
        setAddedIds((prev) => new Set(Array.from(prev).concat(item.id)));
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
    } finally {
      setAddingId(null);
    }
  }, [hydrate, toast]);

  const handleRemove = useCallback(async (item: SavedGroceryItem) => {
    setRemovingId(item.id);
    try {
      await apiJSON(`/api/saved-groceries/${item.id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['/api/saved-groceries'] });
      toast({ title: "Removed", description: `${item.productName} removed from saved groceries.` });
    } catch {
      toast({ title: "Couldn't remove item", description: "Please try again.", variant: "destructive" });
    } finally {
      setRemovingId(null);
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
                        {bulkAdding ? "Adding…" : `Add Selected${selectedIds.size ? ` (${selectedIds.size})` : ""}`}
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
                        const isAdding = addingId === item.id;
                        const isAdded = addedIds.has(item.id);
                        const onList = isItemOnList(item);
                        const isSelected = selectedIds.has(item.id);
                        const isBlocked = item.compliance.status === "blocked";
                        const isRemoving = removingId === item.id;
                        const hasAnalysis = !!(item.productMeta?.alignmentGrade || item.productMeta?.resolvedFromDb !== undefined
                          || Array.isArray(item.productMeta?.recommendationWhyBetter));

                        return (
                          <div
                            key={item.id}
                            style={{
                               display: "grid",
                               gridTemplateColumns: "auto minmax(0, 1fr)",
                               alignItems: "start",
                               columnGap: 10,
                               rowGap: 10,
                              padding: "10px 12px", borderRadius: 10,
                              background: "rgba(255,255,255,0.04)",
                              border: "1px solid rgba(255,255,255,0.07)",
                            }}
                          >
                            {isBlocked ? (
                              <AlertTriangle aria-hidden="true" style={{ width: 20, height: 20, color: "#fca5a5", marginTop: 3 }} />
                            ) : (
                              <label style={{ display: "flex", alignItems: "center", justifyContent: "center", minWidth: 44, minHeight: 44, cursor: "pointer" }}>
                                <input type="checkbox" aria-label={`Select ${itemDisplayName(item)}`}
                                  style={{ width: 22, height: 22, accentColor: "#38bdf8", cursor: "pointer" }}
                                  checked={isSelected} disabled={bulkAdding}
                                  onChange={() => toggleSelected(item.id)} />
                              </label>
                            )}

                            {/* Tappable product info — opens analysis sheet if data exists */}
                            <button
                              onClick={() => { setHistoryIndex(-1); setAnalysisItem(item); }}
                              style={{
                                flex: 1, minWidth: 0, background: "none", border: "none",
                                cursor: hasAnalysis ? "pointer" : "default",
                                textAlign: "left", padding: 0,
                              }}
                            >
                               <div style={{ display: "flex", alignItems: "flex-start", gap: 4 }}>
                                 <div style={{
                                   color: "white",
                                   fontWeight: 600,
                                   fontSize: 14,
                                   lineHeight: 1.35,
                                   overflowWrap: "anywhere",
                                 }}>
                                  {item.productName}
                                </div>
                                {hasAnalysis && (
                                   <ChevronRight style={{ width: 13, height: 13, marginTop: 3, color: "rgba(249,115,22,0.6)", flexShrink: 0 }} />
                                )}
                              </div>
                               <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
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
                                {isBlocked && (
                                  <span
                                    title={item.compliance.reason ?? "Does not fit your current profile"}
                                    style={{
                                      padding: "1px 6px", borderRadius: 999, fontSize: 10, fontWeight: 600,
                                      background: "rgba(239,68,68,0.14)", color: "#fca5a5",
                                      border: "1px solid rgba(239,68,68,0.3)",
                                    }}
                                  >
                                    {savedProductStatus(item)}
                                  </span>
                                )}
                              </div>
                              {isBlocked && (
                                <div style={{ color: "#fca5a5", fontSize: 11, lineHeight: 1.35, marginTop: 5 }}>
                                  {item.compliance.reason || "Current compatibility could not be verified. View Analysis for details."}
                                </div>
                              )}
                            </button>

                             <div
                               style={{
                                 gridColumn: "1 / -1",
                                 display: "flex",
                                 alignItems: "center",
                                 justifyContent: "flex-end",
                                 gap: 8,
                                 flexWrap: "wrap",
                                 paddingTop: 2,
                                 borderTop: "1px solid rgba(255,255,255,0.06)",
                               }}
                            >
                               <PillButton
                                 type="button"
                                 variant="sky"
                                 onClick={() => { setHistoryIndex(-1); setAnalysisItem(item); }}
                                 aria-label={`View Analysis: ${itemDisplayName(item)}`}
                               >
                                 View Analysis
                               </PillButton>
                               {isBlocked && item.compliance.category === "evidence_missing" && onVerifyProduct
                                 && !/certif/i.test(item.compliance.reason || "") && (
                                 <PillButton type="button" variant="amber" onClick={() => {
                                   onOpenChange(false); onVerifyProduct(item);
                                 }} aria-label={`Verify Label: ${itemDisplayName(item)}`}>
                                   Verify Label
                                 </PillButton>
                               )}
                               {isBlocked && item.compliance.category === "profile_unavailable" && (
                                 <PillButton type="button" variant="amber" onClick={() => fetchItems()}
                                   aria-label={`Retry Check: ${itemDisplayName(item)}`}>
                                   Retry Check
                                 </PillButton>
                               )}
                               {isBlocked && /certif/i.test(item.compliance.reason || "") && (
                                 <p style={{ flexBasis: "100%", color: "#fca5a5", fontSize: 11 }}>
                                   A label photo alone cannot verify independent certification.
                                 </p>
                               )}
                               {/* Add to list */}
                               {!isBlocked && (
                               <PillButton
                                 type="button"
                                 variant={isBlocked ? "rose" : onList || isAdded ? "emerald" : "amber"}
                                 active={onList || isAdded}
                                 onClick={() => handleAddToList(item)}
                                 disabled={isAdding || isAdded || onList || isBlocked || bulkAdding}
                                 className="!px-3 !text-[9px] shrink-0"
                               >
                                 {isAdding ? (
                                   <Loader2 style={{ width: 13, height: 13, animation: "spin 1s linear infinite" }} />
                                 ) : onList ? (
                                   <><CheckCircle2 style={{ width: 13, height: 13 }} /> Already on list</>
                                 ) : isBlocked ? (
                                   <><AlertTriangle style={{ width: 13, height: 13 }} /> Cannot add yet</>
                                 ) : isAdded ? (
                                   <><CheckCircle2 style={{ width: 13, height: 13 }} /> Added</>
                                 ) : (
                                   <><ShoppingCart style={{ width: 13, height: 13 }} /> Add</>
                                 )}
                               </PillButton>
                               )}

                               {/* Unsave */}
                               <button
                                 onClick={() => handleRemove(item)}
                                 disabled={isRemoving}
                                 aria-label={`Remove ${itemDisplayName(item)} from saved groceries`}
                                 title="Remove from saved groceries"
                                 style={{
                                   display: "flex", alignItems: "center", justifyContent: "center",
                                   width: 32, height: 32, borderRadius: 8,
                                   border: "1px solid rgba(239,68,68,0.18)",
                                   background: "rgba(239,68,68,0.08)", cursor: "pointer", flexShrink: 0,
                                 }}
                               >
                                 {isRemoving
                                   ? <Loader2 style={{ width: 13, height: 13, color: "#ef4444", animation: "spin 1s linear infinite" }} />
                                   : <Trash2 style={{ width: 13, height: 13, color: "rgba(239,68,68,0.7)" }} />
                                 }
                               </button>
                             </div>
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
  const storedScores = displayedItem?.productMeta?.analysisSnapshot?.scoreCards ?? displayedItem?.nutritionJson?.scoreCards;
  const analysisSheet = analysisItem && loadedOwner === owner ? (
    <IngredientIntelligenceSheet
      key={`${analysisItem.id}:${historyIndex}`}
      open={!!analysisItem}
      hideSaveAction
      hideLegacyScoreCards={!["kids", "adults", "diet", "fitnessGoal"].every(key => storedScores?.[key]?.verdict)}
      result={buildResultFromSavedItem(displayedItem!)}
      savedContext={<section className="rounded-xl border border-white/20 p-3 my-3 text-sm space-y-2">
        <p>{analysisItem.productMeta?.analysisSnapshot ? "Analysis saved" : analysisItem.productMeta?.reason || analysisItem.productMeta?.recommendationWhyBetter ? "Recommendation saved" : "Saved product — original analysis may be unavailable"}</p>
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
