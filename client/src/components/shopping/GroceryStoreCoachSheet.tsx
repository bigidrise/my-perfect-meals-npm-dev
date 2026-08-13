import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ChefHat,
  Send,
  ShoppingCart,
  RefreshCw,
  CheckCircle2,
  Clock,
  Users,
  ChevronDown,
  ChevronUp,
  Minus,
  Plus,
  Sparkles,
  XCircle,
  Loader2,
  BookmarkCheck,
  Bookmark,
  AlertTriangle,
  ArrowLeftRight,
} from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { PillButton } from "@/components/ui/pill-button";
import { get, post } from "@/lib/api";
import { useShoppingListStore } from "@/stores/shoppingListStore";
import type { UniversalIngredient } from "@/stores/shoppingListStore";

type Phase = "idle" | "loading" | "result";

interface ShoppingListItem {
  item: string;
  quantity: string;
  unit: string;
  category: string;
}

interface CoachResult {
  meal: { name: string; description: string; prepTime: string; servings: number };
  reasoning: string[];
  macros: { calories: number; protein: number; carbs: number; fat: number };
  ownedIngredients: Array<{ item: string; quantity: string; unit: string }>;
  shoppingList: ShoppingListItem[];
  followUpSuggestions: string[];
  servingCount: number;
  /** Present when both generation attempts failed the post-gen protocol scan.
   * Coach-voice warning the user should read before acting on this recommendation. */
  protocolWarning?: string;
  /** Human-readable violation summary from the protocol scan — shown inside the warning banner. */
  ndeSummary?: string;
}

type CardPhase = "idle" | "generating" | "ready" | "failed";

interface MealCardRef {
  id: string;
  imageUrl: string | null;
  destination: string;
  title: string;
}

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

interface BrandRecommendation {
  brand: string;
  rank: 1 | 2 | 3;
  grade: "A" | "B" | "C";
  reason: string;
}

interface AvoidRecommendation {
  brand: string;
  reason: string;
}

interface IngredientAdvice {
  ingredient: string;
  category: string;
  recommended: BrandRecommendation[];
  avoid: AvoidRecommendation[];
}

interface ProductAdviceResult {
  advice: IngredientAdvice[];
  profileUsed: string[];
  store?: string;
}

interface SwapSuggestion {
  item: string;
  reason: string;
  quantity?: string;
  unit?: string;
}

interface SwapResult {
  coachSuggestion: SwapSuggestion;
  savedOption: SwapSuggestion | null;
  alternatives: SwapSuggestion[];
  protocolNote: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const QUICK_STARTS = [
  "What's for dinner tonight?",
  "Give me something high-protein",
  "I need something quick",
  "Family-friendly meal",
  "Something diabetic-friendly",
  "Heart-healthy option",
];

const LOADING_MESSAGES = [
  "Checking your health profile…",
  "Finding the right meal for you…",
  "Scaling ingredient quantities…",
  "Building your shopping list…",
  "Personalizing your recommendation…",
];

const RANK_MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

/** Stable product key — must stay in sync with server/routes/savedGroceries.ts */
export function computeClientProductKey(brand: string, ingredient: string): string {
  const b = brand.toLowerCase().replace(/[^a-z0-9]/g, "");
  const n = ingredient.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `name::${b}::${n}`;
}
const GRADE_COLOR: Record<string, string> = {
  A: "rgba(16,185,129,0.9)",
  B: "rgba(251,191,36,0.9)",
  C: "rgba(249,115,22,0.9)",
};

const MACRO_CATEGORY_ORDER = [
  "Produce", "Meat", "Plant Proteins", "Dairy & Eggs",
  "Grains & Packaged", "Pantry", "Frozen", "Other",
];

function groupByCategory(items: ShoppingListItem[]): Record<string, ShoppingListItem[]> {
  const groups: Record<string, ShoppingListItem[]> = {};
  for (const item of items) {
    const cat = item.category || "Other";
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(item);
  }
  return groups;
}

export default function GroceryStoreCoachSheet({ open, onOpenChange }: Props) {
  const { toast } = useToast();
  const addItems = useShoppingListStore((s) => s.addItems);
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  // Session key is scoped by userId so one user's meal data is never shown
  // to a subsequently authenticated user on a shared browser or device.
  const sessionKey = useMemo(
    () => (user?.id ? `grocery-coach-session:${user.id}` : null),
    [user?.id],
  );

  const [phase, setPhase] = useState<Phase>("idle");
  const [servingCount, setServingCount] = useState(1);
  const [input, setInput] = useState("");
  const [result, setResult] = useState<CoachResult | null>(null);
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0]);
  const [addedToList, setAddedToList] = useState(false);
  const [listExpanded, setListExpanded] = useState(true);
  const [cartExpanded, setCartExpanded] = useState(true);

  const [cardPhase, setCardPhase] = useState<CardPhase>("idle");
  const [mealCard, setMealCard] = useState<MealCardRef | null>(null);

  const [productAdvice, setProductAdvice] = useState<ProductAdviceResult | null>(null);
  const [advisorLoading, setAdvisorLoading] = useState(false);
  const [brandsAdded, setBrandsAdded] = useState(false);
  // Saved groceries — keys of items the user has already saved
  const [savedProductKeys, setSavedProductKeys] = useState<Set<string>>(new Set());
  const [savingKey, setSavingKey] = useState<string | null>(null);
  // Smart Cart "show saved only" toggle
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  // Count of top-brand picks added so the "View List" banner shows the right number
  const [brandsAddedCount, setBrandsAddedCount] = useState(0);
  // Per-ingredient swap state
  const [swapTarget, setSwapTarget] = useState<ShoppingListItem | null>(null);
  const [swapResult, setSwapResult] = useState<SwapResult | null>(null);
  const [swapLoading, setSwapLoading] = useState(false);
  const [swapCustom, setSwapCustom] = useState("");
  const [swapCustomLoading, setSwapCustomLoading] = useState(false);
  const [swapSelected, setSwapSelected] = useState<SwapSuggestion | null>(null);
  const [swapError, setSwapError] = useState<string | null>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const loadingInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Session persistence ──────────────────────────────────────────────────────
  // Sessions are keyed by userId and guarded by a `sessionReady` gate that
  // prevents in-flight state from the previous user from being written under the
  // new user's key when identity changes.
  //
  // Lifecycle on user switch:
  //   1. sessionKey changes → sessionReady=false, state cleared
  //   2. hydration effect reads new user's stored session
  //   3. sessionReady=true → persistence is unblocked for the new user
  const [sessionReady, setSessionReady] = useState(false);

  // Hydrate: clears prior state immediately on identity change, then restores.
  useEffect(() => {
    // Identity changed — block persistence and wipe stale state before reading
    // the new user's session. This prevents the old result from being written
    // to the new user's key by a persistence effect that fires between renders.
    setSessionReady(false);
    setResult(null);
    setConversation([]);
    setPhase("idle");

    if (!sessionKey) return; // not authenticated — leave cleared

    try {
      const raw = localStorage.getItem(sessionKey);
      if (!raw) { setSessionReady(true); return; }
      const session = JSON.parse(raw) as {
        result?: CoachResult;
        conversation?: ConversationMessage[];
        savedAt?: number;
      };
      // Expire after 24 h
      if (!session.savedAt || Date.now() - session.savedAt > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(sessionKey);
        setSessionReady(true);
        return;
      }
      if (session.result) {
        setResult(session.result);
        setPhase("result");
      }
      if (session.conversation?.length) {
        setConversation(session.conversation);
      }
    } catch { /* ignore parse/storage errors */ }

    setSessionReady(true);
  }, [sessionKey]); // re-runs whenever the authenticated user changes

  // Persist: only runs after hydration completes to prevent cross-account writes.
  useEffect(() => {
    if (!sessionKey || !result || !sessionReady) return;
    try {
      localStorage.setItem(sessionKey, JSON.stringify({
        result,
        conversation,
        savedAt: Date.now(),
      }));
    } catch {}
  }, [sessionKey, result, conversation, sessionReady]);

  useEffect(() => {
    if (!open) {
      // Reset transient UI state only.
      // result / conversation / phase are intentionally preserved so the user
      // returns to their meal when they reopen the sheet.
      setInput("");
      setAddedToList(false);
      setListExpanded(true);
      setCartExpanded(true);
      setCardPhase("idle");
      setMealCard(null);
      setProductAdvice(null);
      setAdvisorLoading(false);
      setBrandsAdded(false);
      setSavedProductKeys(new Set());
      setSavingKey(null);
      setShowSavedOnly(false);
      setBrandsAddedCount(0);
      setSwapTarget(null);
      setSwapResult(null);
      setSwapLoading(false);
      setSwapCustom("");
      setSwapCustomLoading(false);
      setSwapSelected(null);
      setSwapError(null);
      if (loadingInterval.current) clearInterval(loadingInterval.current);
    }
  }, [open]);

  useEffect(() => {
    if (phase === "loading") {
      let idx = 0;
      setLoadingMsg(LOADING_MESSAGES[0]);
      loadingInterval.current = setInterval(() => {
        idx = (idx + 1) % LOADING_MESSAGES.length;
        setLoadingMsg(LOADING_MESSAGES[idx]);
      }, 1400);
    } else {
      if (loadingInterval.current) clearInterval(loadingInterval.current);
    }
    return () => { if (loadingInterval.current) clearInterval(loadingInterval.current); };
  }, [phase]);

  const fetchProductAdvice = useCallback(async (shoppingList: ShoppingListItem[]) => {
    if (!shoppingList.length) return;
    setAdvisorLoading(true);
    setProductAdvice(null);
    setBrandsAdded(false);
    try {
      const ingredients = shoppingList.map((s) => s.item);
      const data = await post("/api/grocery-coach/product-advisor", { ingredients });
      if (data?.advice?.length) {
        setProductAdvice(data as ProductAdviceResult);
      }
    } catch {
    } finally {
      setAdvisorLoading(false);
    }
  }, []);

  // ── Saved Groceries helpers ──────────────────────────────────────────────────
  const fetchSavedKeys = useCallback(async () => {
    try {
      const data = await get<{ items: Array<{ productKey: string }> }>("/api/saved-groceries");
      const keys = new Set<string>((data.items ?? []).map((i) => i.productKey));
      setSavedProductKeys(keys);
    } catch {
      // Non-critical — bookmarks just won't pre-fill
    }
  }, []);

  // Refresh saved keys whenever product advice loads so bookmarks are accurate
  useEffect(() => {
    if (productAdvice) fetchSavedKeys();
  }, [productAdvice, fetchSavedKeys]);

  const handleSaveGrocery = useCallback(async (
    ingredient: string,
    category: string,
    brand: BrandRecommendation,
  ) => {
    const productKey = computeClientProductKey(brand.brand, ingredient);
    if (savedProductKeys.has(productKey) || savingKey === productKey) return;
    setSavingKey(productKey);
    try {
      await post("/api/saved-groceries", {
        productName: ingredient,
        brand: brand.brand,
        category,
        source: "grocery-coach",
        productMeta: {
          ingredient,
          brand: brand.brand,
          rank: brand.rank,
          grade: brand.grade,
          reason: brand.reason,
        },
      });
      setSavedProductKeys((prev) => new Set(Array.from(prev).concat(productKey)));
    } catch {
      // Silently fail — user can tap again
    } finally {
      setSavingKey(null);
    }
  }, [savedProductKeys, savingKey]);

  const sendMessage = useCallback(async (msg: string) => {
    if (!msg.trim()) return;
    const userMsg = msg.trim();
    setInput("");
    setPhase("loading");
    setAddedToList(false);
    setProductAdvice(null);
    setBrandsAdded(false);
    setShowSavedOnly(false);

    const newConvo: ConversationMessage[] = [
      ...conversation,
      { role: "user", content: userMsg },
    ];

    try {
      const data = await post("/api/grocery-coach/recommend", {
        message: userMsg,
        conversationHistory: conversation,
        servingCount,
      });

      if (data?.error) throw new Error(data.error);

      const assistantSummary = `Recommended: ${data.meal?.name || "a meal"}`;
      setConversation([...newConvo, { role: "assistant", content: assistantSummary }]);
      const coachResult = data as CoachResult;
      setResult(coachResult);
      setPhase("result");
      setListExpanded(true);
      setCartExpanded(true);
      setCardPhase("generating");
      setMealCard(null);

      // Trigger card generation immediately — non-blocking to the recommendation display
      finalizeCard(coachResult);

      // Build the combined ingredient list once — shoppingList (items to buy) +
      // ownedIngredients (items the model assumed you already have) — so the
      // Product Advisor can return brand picks for every ingredient that lands
      // on the full shopping list, not just the ones flagged as "needs buying".
      const allIngredients: ShoppingListItem[] = [
        ...(data.shoppingList ?? []),
        ...(data.ownedIngredients ?? []).map((o: { item: string; quantity: string; unit: string }) => ({
          ...o,
          category: "Other" as const,
        })),
      ];
      if (allIngredients.length) {
        fetchProductAdvice(allIngredients);
      }
    } catch (err: any) {
      setPhase("idle");
      toast({
        title: "Coach unavailable",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
      setConversation(newConvo.slice(0, -1));
    }
  }, [conversation, servingCount, toast, fetchProductAdvice]);

  const handleNewSession = useCallback(() => {
    try { if (sessionKey) localStorage.removeItem(sessionKey); } catch {}
    setPhase("idle");
    setResult(null);
    setConversation([]);
    setInput("");
    setAddedToList(false);
    setListExpanded(true);
    setCartExpanded(true);
    setCardPhase("idle");
    setMealCard(null);
    setProductAdvice(null);
    setAdvisorLoading(false);
    setBrandsAdded(false);
    setSavedProductKeys(new Set());
    setSavingKey(null);
    setShowSavedOnly(false);
    setBrandsAddedCount(0);
    setSwapTarget(null);
    setSwapResult(null);
    setSwapLoading(false);
    setSwapCustom("");
    setSwapCustomLoading(false);
    setSwapSelected(null);
    setSwapError(null);
  }, []);

  const handleAddToList = useCallback(() => {
    if (!result?.shoppingList?.length) return;
    // Only add shoppingList items — those are the things the user needs to buy.
    // ownedIngredients are items the user already has at home and must NOT be
    // added to the purchase list.
    const allItems: UniversalIngredient[] = result.shoppingList.map((s) => ({
      name: s.item,
      quantity: parseFloat(s.quantity) || 1,
      unit: s.unit || "",
      sourceMeals: [result.meal?.name || "Grocery Coach"],
    }));
    addItems(allItems);
    setAddedToList(true);
    toast({ title: "Added to shopping list!", description: `${allItems.length} items added.` });
  }, [result, addItems, toast]);

  const handleAddBrandsToList = useCallback(() => {
    if (!productAdvice?.advice?.length || !result) return;
    const items: UniversalIngredient[] = [];
    for (const advice of productAdvice.advice) {
      const top = advice.recommended.find((r) => r.rank === 1);
      if (top) {
        items.push({
          name: top.brand,
          quantity: 1,
          unit: "",
          sourceMeals: [result.meal?.name || "Grocery Coach"],
        });
      }
    }
    if (items.length) {
      addItems(items);
      setBrandsAdded(true);
      setBrandsAddedCount(items.length);
      toast({ title: "Top picks added!", description: `${items.length} brand recommendation${items.length !== 1 ? "s" : ""} added to your list.` });
    }
  }, [productAdvice, result, addItems, toast]);

  const finalizeCard = useCallback(async (coachResult: CoachResult) => {
    try {
      const data = await post("/api/grocery-coach/finalize-card", {
        recommendation: coachResult,
      });
      if (data?.status === "ready" && data?.id) {
        setMealCard({
          id: data.id,
          imageUrl: data.imageUrl ?? null,
          destination: data.destination ?? `/saved-meals?mealId=${data.id}`,
          title: data.title ?? coachResult.meal?.name ?? "Your Meal",
        });
        setCardPhase("ready");
      } else {
        setCardPhase("failed");
      }
    } catch {
      setCardPhase("failed");
    }
  }, []);

  const handleGenerateAnother = useCallback(() => {
    sendMessage("Give me a different option");
  }, [sendMessage]);

  // ── Per-ingredient swap ───────────────────────────────────────────────────────
  const handleSwapRequest = useCallback(async (item: ShoppingListItem, customRequest?: string) => {
    setSwapTarget(item);
    setSwapResult(null);
    setSwapSelected(null);
    setSwapError(null);
    if (customRequest !== undefined) {
      setSwapCustomLoading(true);
    } else {
      setSwapCustom("");
      setSwapLoading(true);
    }
    try {
      const remaining = result?.shoppingList
        .filter((s) => s.item !== item.item)
        .map((s) => s.item) ?? [];
      const data = await post<SwapResult>("/api/grocery-coach/swap-ingredient", {
        ingredientToReplace: item.item,
        mealName: result?.meal?.name,
        mealDescription: result?.meal?.description,
        remainingIngredients: remaining,
        ...(customRequest ? { userRequest: customRequest } : {}),
      });
      setSwapResult(data);
      setSwapSelected(data.coachSuggestion);
    } catch (err: any) {
      setSwapError(err?.message || "Could not get suggestions. Please try again.");
    } finally {
      setSwapLoading(false);
      setSwapCustomLoading(false);
    }
  }, [result]);

  const handleConfirmSwap = useCallback(() => {
    if (!swapTarget || !swapSelected) return;
    setResult((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        shoppingList: prev.shoppingList.map((s) =>
          s.item === swapTarget.item && s.category === swapTarget.category
            ? {
                ...s,
                item: swapSelected.item,
                quantity: swapSelected.quantity ?? s.quantity,
                unit: swapSelected.unit ?? s.unit,
              }
            : s
        ),
      };
    });
    const replaced = swapTarget.item;
    const chosen = swapSelected.item;
    setSwapTarget(null);
    setSwapResult(null);
    setSwapSelected(null);
    setSwapCustom("");
    toast({ title: "Ingredient replaced!", description: `${replaced} → ${chosen}` });
  }, [swapTarget, swapSelected, toast]);

  const handleSubmit = useCallback(() => {
    sendMessage(input);
  }, [input, sendMessage]);

  const groupedList = result ? groupByCategory(result.shoppingList || []) : {};
  const sortedCategories = MACRO_CATEGORY_ORDER.filter((c) => groupedList[c]);
  const otherCategories = Object.keys(groupedList).filter((c) => !MACRO_CATEGORY_ORDER.includes(c));

  const hasAdvice = productAdvice && productAdvice.advice.length > 0;
  const avoidList = productAdvice?.advice.flatMap((a) => a.avoid) ?? [];

  if (!open) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(0,0,0,0.7)" }}
        onClick={() => onOpenChange(false)}
      />

      {/* Panel — backdrop is full-viewport; panel is centered to the app's 896px column */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "100%",
          maxWidth: 896,
          zIndex: 9999,
          maxHeight: "92dvh",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(to bottom, #0d0d0d, #111111)",
          borderTop: "1px solid rgba(249,115,22,0.3)",
          borderLeft: "1px solid rgba(249,115,22,0.3)",
          borderRight: "1px solid rgba(249,115,22,0.3)",
          borderRadius: "16px 16px 0 0",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 16px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }}>
          <div style={{ padding: 8, borderRadius: 12, background: "rgba(234,88,12,0.2)", border: "1px solid rgba(249,115,22,0.3)" }}>
            <ChefHat style={{ width: 20, height: 20, color: "#fb923c" }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: "white", fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>Grocery Store Coach</div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>Decide what to make. Know what to buy.</div>
          </div>
          {result && (
            <button
              onClick={handleNewSession}
              title="Start a new session"
              style={{ padding: "5px 10px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.45)", fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
            >
              New
            </button>
          )}
          <button
            onClick={() => onOpenChange(false)}
            style={{ padding: 8, borderRadius: 12, background: "rgba(255,255,255,0.05)", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ flex: 1, overflowY: "auto", overscrollBehavior: "contain", minHeight: 0 }}>
          <AnimatePresence mode="wait">

            {/* ── IDLE ── */}
            {phase === "idle" && (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ padding: 16, display: "flex", flexDirection: "column", gap: 20, paddingBottom: 16 }}
              >
                <div>
                  <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                    How many people?
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                    <button
                      onClick={() => setServingCount((n) => Math.max(1, n - 1))}
                      disabled={servingCount <= 1}
                      style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", justifyContent: "center", opacity: servingCount <= 1 ? 0.3 : 1, cursor: servingCount <= 1 ? "not-allowed" : "pointer" }}
                    >
                      <Minus style={{ width: 14, height: 14 }} />
                    </button>
                    <div style={{ flex: 1, textAlign: "center" }}>
                      <div style={{ color: "white", fontWeight: 700, fontSize: 28 }}>{servingCount}</div>
                      <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginTop: 2 }}>
                        {servingCount === 1 ? "Just me" : servingCount === 2 ? "2 people" : `${servingCount} people`}
                      </div>
                    </div>
                    <button
                      onClick={() => setServingCount((n) => Math.min(12, n + 1))}
                      disabled={servingCount >= 12}
                      style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", justifyContent: "center", opacity: servingCount >= 12 ? 0.3 : 1, cursor: servingCount >= 12 ? "not-allowed" : "pointer" }}
                    >
                      <Plus style={{ width: 14, height: 14 }} />
                    </button>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <button
                        key={n}
                        onClick={() => setServingCount(n)}
                        style={{
                          flex: 1, padding: "8px 0", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                          background: servingCount === n ? "#ea580c" : "rgba(255,255,255,0.05)",
                          color: servingCount === n ? "white" : "rgba(255,255,255,0.5)",
                          border: servingCount === n ? "1px solid #f97316" : "1px solid rgba(255,255,255,0.1)",
                        }}
                      >
                        {n === 1 ? "Me" : n}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                    Quick start
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {QUICK_STARTS.map((chip) => (
                      <button
                        key={chip}
                        onClick={() => sendMessage(chip)}
                        style={{ padding: "8px 12px", borderRadius: 999, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", fontSize: 13, cursor: "pointer" }}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── LOADING ── */}
            {phase === "loading" && (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 16px", gap: 20 }}
              >
                <div style={{ position: "relative" }}>
                  <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(234,88,12,0.2)", border: "2px solid rgba(249,115,22,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <ChefHat style={{ width: 28, height: 28, color: "#fb923c" }} />
                  </div>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                    style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "2px solid transparent", borderTopColor: "#f97316" }}
                  />
                </div>
                <motion.div key={loadingMsg} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
                  style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, textAlign: "center", fontWeight: 500 }}
                >
                  {loadingMsg}
                </motion.div>
              </motion.div>
            )}

            {/* ── RESULT ── */}
            {phase === "result" && result && (
              <motion.div key="result" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16, paddingBottom: 16 }}
              >
                {/* Meal card */}
                <div style={{ borderRadius: 12, background: "rgba(234,88,12,0.12)", border: "1px solid rgba(249,115,22,0.3)", padding: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <div style={{ color: "#fb923c", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      Tonight's Recommendation
                    </div>
                    {cardPhase === "ready" && (
                      <div style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(5,150,105,0.18)", border: "1px solid rgba(52,211,153,0.35)", borderRadius: 999, padding: "3px 9px" }}>
                        <BookmarkCheck style={{ width: 12, height: 12, color: "#34d399", flexShrink: 0 }} />
                        <span style={{ color: "#34d399", fontSize: 11, fontWeight: 600 }}>Saved to Favorites</span>
                      </div>
                    )}
                  </div>
                  <div style={{ color: "white", fontWeight: 700, fontSize: 20, lineHeight: 1.2, marginBottom: 8 }}>
                    {result.meal?.name || "Your Personalized Meal"}
                  </div>
                  <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, lineHeight: 1.5, marginBottom: 12 }}>
                    {result.meal?.description}
                  </div>
                  <div style={{ display: "flex", gap: 16 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
                      <Clock style={{ width: 14, height: 14, flexShrink: 0 }} />
                      {result.meal?.prepTime || "~30 min"}
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
                      <Users style={{ width: 14, height: 14, flexShrink: 0 }} />
                      {result.servingCount || result.meal?.servings || 1}{" "}
                      {(result.servingCount || result.meal?.servings || 1) === 1 ? "serving" : "servings"}
                    </span>
                  </div>
                </div>

                {/* ── Card generation status ── */}
                {cardPhase === "generating" && (
                  <div style={{ borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                    <Loader2 style={{ width: 16, height: 16, color: "#fb923c", flexShrink: 0, animation: "spin 1s linear infinite" }} />
                    <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>Creating your personalized recipe card…</span>
                  </div>
                )}

                {cardPhase === "ready" && mealCard && (
                  <div style={{ borderRadius: 12, background: "rgba(5,150,105,0.1)", border: "1px solid rgba(52,211,153,0.3)", padding: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <CheckCircle2 style={{ width: 18, height: 18, color: "#34d399", flexShrink: 0 }} />
                      <span style={{ color: "#34d399", fontWeight: 700, fontSize: 15 }}>Recipe Ready</span>
                    </div>
                    <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, lineHeight: 1.55, marginBottom: 14 }}>
                      Your Grocery Coach created a complete meal card and saved it to <span style={{ color: "white", fontWeight: 600 }}>Favorites</span>. It includes the recipe, cooking instructions, nutrition details, and your full shopping list.
                    </div>
                    <button
                      onClick={() => { onOpenChange(false); setLocation(mealCard.destination); }}
                      style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px 0", borderRadius: 10, background: "rgba(52,211,153,0.2)", border: "1px solid rgba(52,211,153,0.4)", color: "#34d399", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
                    >
                      <BookmarkCheck style={{ width: 16, height: 16, flexShrink: 0 }} />
                      View Meal Card
                    </button>
                  </div>
                )}

                {cardPhase === "failed" && result && (
                  <div style={{ borderRadius: 12, background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <AlertTriangle style={{ width: 16, height: 16, color: "#f87171", flexShrink: 0, marginTop: 1 }} />
                      <span style={{ color: "rgba(255,255,255,0.65)", fontSize: 13, lineHeight: 1.45 }}>
                        Your recommendation is ready, but the full recipe card could not be saved. Tap below to try again.
                      </span>
                    </div>
                    <button
                      onClick={() => { setCardPhase("generating"); finalizeCard(result); }}
                      style={{ alignSelf: "flex-start", padding: "7px 14px", borderRadius: 8, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                    >
                      Try Again
                    </button>
                  </div>
                )}

                {/* Macros */}
                {result.macros && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {[
                      { label: "Calories", value: result.macros.calories, unit: "" },
                      { label: "Protein",  value: result.macros.protein,  unit: "g" },
                      { label: "Carbs",    value: result.macros.carbs,    unit: "g" },
                      { label: "Fat",      value: result.macros.fat,      unit: "g" },
                    ].map(({ label, value, unit }) => (
                      <div key={label} style={{ borderRadius: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", padding: 12, textAlign: "center" }}>
                        <div style={{ color: "white", fontWeight: 700, fontSize: 18, lineHeight: 1 }}>{value ?? "—"}{unit}</div>
                        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, marginTop: 4, fontWeight: 500 }}>{label}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Why This Fits You */}
                {result.reasoning?.length > 0 && (
                  <div style={{ borderRadius: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", padding: 16 }}>
                    <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
                      Why This Fits You
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {result.reasoning.map((r, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, color: "rgba(255,255,255,0.8)" }}>
                          <CheckCircle2 style={{ width: 16, height: 16, color: "#fb923c", flexShrink: 0, marginTop: 1 }} />
                          <span style={{ lineHeight: 1.4 }}>{r}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Shopping list */}
                {result.shoppingList?.length > 0 && (
                  <div style={{ borderRadius: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", overflow: "hidden" }}>
                    <button
                      onClick={() => setListExpanded((v) => !v)}
                      style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <ShoppingCart style={{ width: 16, height: 16, color: "#fb923c" }} />
                        <span style={{ color: "white", fontWeight: 600, fontSize: 14 }}>Shopping List</span>
                        <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>({result.shoppingList.length} items)</span>
                      </div>
                      {listExpanded
                        ? <ChevronUp style={{ width: 16, height: 16, color: "rgba(255,255,255,0.4)" }} />
                        : <ChevronDown style={{ width: 16, height: 16, color: "rgba(255,255,255,0.4)" }} />
                      }
                    </button>

                    <AnimatePresence initial={false}>
                      {listExpanded && (
                        <motion.div
                          initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
                          transition={{ duration: 0.2 }}
                          style={{ overflow: "hidden" }}
                        >
                          <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
                            {[...sortedCategories, ...otherCategories].map((cat) => (
                              <div key={cat}>
                                <div style={{ color: "rgba(251,146,60,0.7)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                                  {cat}
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                  {groupedList[cat].map((s, i) => (
                                    <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 14, padding: "2px 0" }}>
                                      <span style={{ color: "rgba(255,255,255,0.85)", lineHeight: 1.3, flex: 1, minWidth: 0 }}>{s.item}</span>
                                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                                        <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>{s.quantity} {s.unit}</span>
                                        <button
                                          onClick={() => handleSwapRequest(s)}
                                          title={`Replace ${s.item}`}
                                          style={{
                                            display: "flex", alignItems: "center", gap: 4,
                                            padding: "3px 8px", borderRadius: 999,
                                            border: "1px solid rgba(255,255,255,0.12)",
                                            background: "rgba(255,255,255,0.05)",
                                            color: "rgba(255,255,255,0.4)",
                                            fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
                                          }}
                                        >
                                          <ArrowLeftRight style={{ width: 10, height: 10 }} />
                                          Replace
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* ── Product Advisor / Smart Cart ── */}
                {(advisorLoading || hasAdvice) && (
                  <div style={{ borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(249,115,22,0.2)", overflow: "hidden" }}>

                    {/* Header row */}
                    {(() => {
                      const hasSavedInCart = hasAdvice && productAdvice!.advice.some((a) =>
                        a.recommended.some((b) => savedProductKeys.has(computeClientProductKey(b.brand, a.ingredient)))
                      );
                      return (
                        <div style={{ display: "flex", alignItems: "center" }}>
                          <button
                            onClick={() => setCartExpanded((v) => !v)}
                            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <Sparkles style={{ width: 16, height: 16, color: "#fb923c" }} />
                              <span style={{ color: "white", fontWeight: 600, fontSize: 14 }}>Smart Cart</span>
                              {advisorLoading && (
                                <div style={{ display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.4)", fontSize: 12 }}>
                                  <Loader2 style={{ width: 12, height: 12, animation: "spin 1s linear infinite" }} />
                                  Finding best brands…
                                </div>
                              )}
                              {hasAdvice && !advisorLoading && (
                                <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>
                                  ({productAdvice!.advice.length} ingredient{productAdvice!.advice.length !== 1 ? "s" : ""})
                                </span>
                              )}
                            </div>
                            {!advisorLoading && (
                              cartExpanded
                                ? <ChevronUp style={{ width: 16, height: 16, color: "rgba(255,255,255,0.4)" }} />
                                : <ChevronDown style={{ width: 16, height: 16, color: "rgba(255,255,255,0.4)" }} />
                            )}
                          </button>
                          {hasSavedInCart && !advisorLoading && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setShowSavedOnly((v) => !v); }}
                              title={showSavedOnly ? "Show all ingredients" : "Show saved favorites only"}
                              style={{
                                flexShrink: 0, display: "flex", alignItems: "center", gap: 5,
                                margin: "0 12px 0 0", padding: "5px 10px", borderRadius: 999,
                                border: showSavedOnly ? "1px solid rgba(249,115,22,0.5)" : "1px solid rgba(255,255,255,0.12)",
                                background: showSavedOnly ? "rgba(249,115,22,0.18)" : "rgba(255,255,255,0.05)",
                                color: showSavedOnly ? "#fb923c" : "rgba(255,255,255,0.45)",
                                fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
                              }}
                            >
                              <BookmarkCheck style={{ width: 12, height: 12, flexShrink: 0 }} />
                              {showSavedOnly ? "Saved only" : "Saved only"}
                            </button>
                          )}
                        </div>
                      );
                    })()}

                    <AnimatePresence initial={false}>
                      {cartExpanded && hasAdvice && !advisorLoading && (
                        <motion.div
                          initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
                          transition={{ duration: 0.25 }}
                          style={{ overflow: "hidden" }}
                        >
                          <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 20 }}>

                            {/* Protocol badges */}
                            {productAdvice!.profileUsed.length > 0 && (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                {productAdvice!.profileUsed.map((p) => (
                                  <span
                                    key={p}
                                    style={{ padding: "3px 10px", borderRadius: 999, background: "rgba(234,88,12,0.15)", border: "1px solid rgba(249,115,22,0.25)", color: "#fb923c", fontSize: 11, fontWeight: 600 }}
                                  >
                                    {p}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Personalization banner + per-ingredient brand cards */}
                            <SmartCartAdviceBody
                              advice={showSavedOnly
                                ? productAdvice!.advice.filter((a) =>
                                    a.recommended.some((b) => savedProductKeys.has(computeClientProductKey(b.brand, a.ingredient)))
                                  )
                                : productAdvice!.advice
                              }
                              savedProductKeys={savedProductKeys}
                              savingKey={savingKey}
                              onSave={handleSaveGrocery}
                            />

                            {/* Summary avoid block */}
                            {avoidList.length === 0 && (
                              <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, textAlign: "center", fontStyle: "italic" }}>
                                No common brands flagged for your protocol — the recommendations above are your best picks.
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* ── Protocol warning banner — shown when both scan attempts failed ── */}
                {result.protocolWarning && (
                  <div style={{
                    borderRadius: 12,
                    background: "rgba(234,179,8,0.1)",
                    border: "1px solid rgba(234,179,8,0.4)",
                    padding: 16,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <AlertTriangle style={{ width: 18, height: 18, color: "#facc15", flexShrink: 0, marginTop: 1 }} />
                      <span style={{ color: "#fef08a", fontWeight: 700, fontSize: 14 }}>Health Protocol Notice</span>
                    </div>
                    <p style={{ color: "rgba(254,240,138,0.85)", fontSize: 13, lineHeight: 1.5, margin: 0 }}>
                      {result.protocolWarning}
                    </p>
                    {result.ndeSummary && (
                      <p style={{ color: "rgba(254,240,138,0.55)", fontSize: 12, lineHeight: 1.4, margin: 0, fontStyle: "italic" }}>
                        {result.ndeSummary}
                      </p>
                    )}
                  </div>
                )}

                {/* Action buttons */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {/* Add all generic items */}
                  <button
                    onClick={handleAddToList}
                    disabled={addedToList}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      padding: "16px 0", borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: addedToList ? "default" : "pointer", border: "none",
                      background: addedToList ? "rgba(5,150,105,0.2)" : "#ea580c",
                      color: addedToList ? "#34d399" : "white",
                    }}
                  >
                    {addedToList ? (
                      <><CheckCircle2 style={{ width: 20, height: 20 }} /> Added to List!</>
                    ) : (
                      <><ShoppingCart style={{ width: 20, height: 20 }} /> Add All to Shopping List</>
                    )}
                  </button>

                  {/* Add top brand picks */}
                  {hasAdvice && (
                    <button
                      onClick={handleAddBrandsToList}
                      disabled={brandsAdded}
                      style={{
                        width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                        padding: "14px 0", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: brandsAdded ? "default" : "pointer",
                        background: brandsAdded ? "rgba(5,150,105,0.15)" : "rgba(234,88,12,0.15)",
                        border: brandsAdded ? "1px solid rgba(52,211,153,0.3)" : "1px solid rgba(249,115,22,0.35)",
                        color: brandsAdded ? "#34d399" : "#fb923c",
                      }}
                    >
                      {brandsAdded ? (
                        <><CheckCircle2 style={{ width: 16, height: 16 }} /> Top Picks Added!</>
                      ) : (
                        <><Sparkles style={{ width: 16, height: 16 }} /> Add Top Brand Picks to List</>
                      )}
                    </button>
                  )}

                  {/* View Shopping List — confirmation banner shown after top picks are added */}
                  {brandsAdded && brandsAddedCount > 0 && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(5,150,105,0.1)", border: "1px solid rgba(52,211,153,0.25)" }}>
                      <span style={{ color: "#34d399", fontSize: 13, fontWeight: 600 }}>
                        {brandsAddedCount} item{brandsAddedCount !== 1 ? "s" : ""} added to your Shopping List
                      </span>
                      <button
                        onClick={() => onOpenChange(false)}
                        style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, background: "rgba(52,211,153,0.15)", border: "1px solid rgba(52,211,153,0.3)", color: "#34d399", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
                      >
                        View List →
                      </button>
                    </div>
                  )}

                  <button
                    onClick={handleGenerateAnother}
                    style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px 0", borderRadius: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
                  >
                    <RefreshCw style={{ width: 16, height: 16 }} />
                    Try a Different Meal
                  </button>
                </div>

                {/* Refine chips */}
                {result.followUpSuggestions?.length > 0 && (
                  <div>
                    <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                      Refine this recommendation
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {result.followUpSuggestions.map((chip) => (
                        <button
                          key={chip}
                          onClick={() => sendMessage(chip)}
                          style={{ padding: "8px 12px", borderRadius: 999, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)", fontSize: 13, cursor: "pointer" }}
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* ── Sticky input footer ── */}
        {phase !== "loading" && (
          <div style={{
            flexShrink: 0,
            borderTop: "1px solid rgba(255,255,255,0.08)",
            padding: "12px 16px",
            paddingBottom: "max(12px, env(safe-area-inset-bottom))",
            background: "#0d0d0d",
          }}>
            {phase === "idle" && (
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                Or describe what you're feeling
              </div>
            )}
            {phase === "result" && (
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                Refine this recommendation
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
                placeholder={
                  phase === "idle"
                    ? "e.g. I have no idea what I want for dinner…"
                    : "Make it cheaper… faster… vegetarian…"
                }
                rows={2}
                style={{
                  flex: 1,
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 12,
                  padding: "10px 12px",
                  color: "white",
                  fontSize: 16,
                  resize: "none",
                  outline: "none",
                  fontFamily: "inherit",
                }}
              />
              <button
                onClick={handleSubmit}
                disabled={!input.trim()}
                style={{
                  padding: "0 16px",
                  borderRadius: 12,
                  background: input.trim() ? "#ea580c" : "rgba(255,255,255,0.1)",
                  border: "none",
                  color: input.trim() ? "white" : "rgba(255,255,255,0.3)",
                  cursor: input.trim() ? "pointer" : "not-allowed",
                  display: "flex",
                  alignItems: "center",
                  flexShrink: 0,
                }}
              >
                <Send style={{ width: 16, height: 16 }} />
              </button>
            </div>
          </div>
        )}

      </div>

      {/* ── Ingredient Swap Modal ─────────────────────────────────────────────
           Absolute overlay covering the full panel so the meal result stays
           mounted underneath. Coach suggests; user taps "Use This" to confirm. */}
      {swapTarget && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 10,
          background: "linear-gradient(to bottom, #0d0d0d, #111111)",
          borderRadius: "16px 16px 0 0",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 16px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }}>
            <button
              onClick={() => { setSwapTarget(null); setSwapResult(null); setSwapError(null); setSwapCustom(""); }}
              style={{ padding: 8, borderRadius: 12, background: "rgba(255,255,255,0.05)", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", display: "flex" }}
            >
              <X style={{ width: 18, height: 18 }} />
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: "white", fontWeight: 700, fontSize: 15 }}>Replace {swapTarget.item}</div>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>Coach keeps the rest of your meal</div>
            </div>
          </div>

          {/* Scrollable content */}
          <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
            {swapLoading && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "48px 0", color: "rgba(255,255,255,0.5)" }}>
                <Loader2 style={{ width: 28, height: 28, color: "#fb923c", animation: "spin 1s linear infinite" }} />
                <span style={{ fontSize: 14 }}>Finding the best replacement…</span>
              </div>
            )}
            {swapError && !swapLoading && (
              <div style={{ padding: 14, borderRadius: 12, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", fontSize: 14 }}>
                {swapError}
              </div>
            )}
            {swapResult && !swapLoading && (
              <>
                {swapResult.protocolNote && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 12px", borderRadius: 10, background: "rgba(234,179,8,0.1)", border: "1px solid rgba(234,179,8,0.3)" }}>
                    <AlertTriangle style={{ width: 14, height: 14, color: "#facc15", flexShrink: 0, marginTop: 2 }} />
                    <span style={{ color: "#fef08a", fontSize: 12, lineHeight: 1.4 }}>{swapResult.protocolNote}</span>
                  </div>
                )}
                <div>
                  <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                    Coach's Best Pick
                  </div>
                  <SwapOptionCard
                    suggestion={swapResult.coachSuggestion}
                    selected={swapSelected?.item === swapResult.coachSuggestion.item}
                    onSelect={() => setSwapSelected(swapResult!.coachSuggestion)}
                    accent="#10b981"
                  />
                </div>
                {swapResult.savedOption && (
                  <div>
                    <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                      ★ From Your Saved Groceries
                    </div>
                    <SwapOptionCard
                      suggestion={swapResult.savedOption}
                      selected={swapSelected?.item === swapResult.savedOption.item}
                      onSelect={() => setSwapSelected(swapResult!.savedOption!)}
                      accent="#f97316"
                    />
                  </div>
                )}
                {swapResult.alternatives.length > 0 && (
                  <div>
                    <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                      Other Options
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {swapResult.alternatives.map((alt) => (
                        <SwapOptionCard
                          key={alt.item}
                          suggestion={alt}
                          selected={swapSelected?.item === alt.item}
                          onSelect={() => setSwapSelected(alt)}
                          accent="rgba(255,255,255,0.3)"
                        />
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                    Or Type What You Want
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      value={swapCustom}
                      onChange={(e) => setSwapCustom(e.target.value)}
                      placeholder="e.g. brown rice, zucchini noodles…"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && swapCustom.trim()) {
                          handleSwapRequest(swapTarget!, swapCustom.trim());
                        }
                      }}
                      style={{
                        flex: 1, padding: "10px 12px", borderRadius: 10,
                        background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
                        color: "white", fontSize: 14, outline: "none",
                      }}
                    />
                    <button
                      onClick={() => { if (swapCustom.trim()) handleSwapRequest(swapTarget!, swapCustom.trim()); }}
                      disabled={!swapCustom.trim() || swapCustomLoading}
                      style={{
                        padding: "10px 14px", borderRadius: 10, border: "none",
                        background: "rgba(249,115,22,0.8)", color: "white",
                        fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center",
                        cursor: (!swapCustom.trim() || swapCustomLoading) ? "not-allowed" : "pointer",
                        opacity: (!swapCustom.trim() || swapCustomLoading) ? 0.5 : 1,
                      }}
                    >
                      {swapCustomLoading
                        ? <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} />
                        : "Ask Coach"
                      }
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Confirm/cancel footer */}
          {(swapResult || swapError) && !swapLoading && (
            <div style={{ padding: 16, borderTop: "1px solid rgba(255,255,255,0.08)", flexShrink: 0, display: "flex", gap: 8 }}>
              <button
                onClick={() => { setSwapTarget(null); setSwapResult(null); setSwapError(null); setSwapCustom(""); }}
                style={{ flex: 1, padding: "14px 0", borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
              >
                Cancel
              </button>
              {swapResult && (
                <button
                  onClick={handleConfirmSwap}
                  disabled={!swapSelected}
                  style={{
                    flex: 2, padding: "14px 0", borderRadius: 12, border: "none",
                    background: swapSelected ? "#ea580c" : "rgba(255,255,255,0.1)",
                    color: swapSelected ? "white" : "rgba(255,255,255,0.3)",
                    fontSize: 14, fontWeight: 700,
                    cursor: swapSelected ? "pointer" : "default",
                  }}
                >
                  Use This
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>,
    document.body
  );
}

// ── SwapOptionCard — selectable replacement card inside the swap modal ────────
function SwapOptionCard({
  suggestion, selected, onSelect, accent,
}: {
  suggestion: SwapSuggestion;
  selected: boolean;
  onSelect: () => void;
  accent: string;
}) {
  return (
    <button
      onClick={onSelect}
      style={{
        width: "100%", textAlign: "left", padding: "12px 14px", borderRadius: 12, cursor: "pointer",
        background: selected ? `${accent}18` : "rgba(255,255,255,0.04)",
        border: selected ? `1px solid ${accent}55` : "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <div style={{
          width: 14, height: 14, borderRadius: "50%", flexShrink: 0,
          border: `2px solid ${selected ? accent : "rgba(255,255,255,0.2)"}`,
          background: selected ? accent : "transparent",
        }} />
        <span style={{ color: "white", fontWeight: 600, fontSize: 14 }}>{suggestion.item}</span>
        {suggestion.quantity && (
          <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>
            · {suggestion.quantity}{suggestion.unit ? ` ${suggestion.unit}` : ""}
          </span>
        )}
      </div>
      <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, lineHeight: 1.4, paddingLeft: 22 }}>
        {suggestion.reason}
      </div>
    </button>
  );
}

export function SmartCartAdviceBody({
  advice,
  savedProductKeys,
  savingKey,
  onSave,
}: SmartCartAdviceBodyProps) {
  const hasSavedItems = advice.some((a) =>
    a.recommended.some((b) => savedProductKeys.has(computeClientProductKey(b.brand, a.ingredient)))
  );

  return (
    <>
      {/* Personalization banner — shown when ≥1 saved favorite is in results */}
      {hasSavedItems && (
        <div
          data-testid="personalization-banner"
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "8px 12px", borderRadius: 8,
            background: "rgba(249,115,22,0.08)",
            border: "1px solid rgba(249,115,22,0.2)",
          }}
        >
          <span style={{ fontSize: 14 }}>★</span>
          <span style={{ color: "#fb923c", fontSize: 12, fontWeight: 600 }}>
            Personalized from your Saved Groceries
          </span>
        </div>
      )}

      {/* Per-ingredient advice */}
      {advice.map((a) => (
        <div key={a.ingredient}>
          <div style={{ color: "rgba(251,146,60,0.7)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
            {a.ingredient}
          </div>

          {/* Recommended brands */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {a.recommended.map((brand) => {
              const pKey = computeClientProductKey(brand.brand, a.ingredient);
              const isSaved = savedProductKeys.has(pKey);
              const isSaving = savingKey === pKey;
              return (
                <div
                  key={brand.brand}
                  style={{
                    display: "flex", alignItems: "flex-start", gap: 10,
                    padding: "10px 12px", borderRadius: 10,
                    background: brand.rank === 1 ? "rgba(16,185,129,0.08)" : "rgba(255,255,255,0.04)",
                    border: brand.rank === 1 ? "1px solid rgba(16,185,129,0.2)" : "1px solid rgba(255,255,255,0.07)",
                  }}
                >
                  <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>
                    {RANK_MEDAL[brand.rank] ?? "•"}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                      <span style={{ color: "white", fontWeight: 600, fontSize: 14 }}>{brand.brand}</span>
                      <span style={{
                        padding: "1px 7px", borderRadius: 999, fontSize: 11, fontWeight: 700,
                        background: `${GRADE_COLOR[brand.grade] ?? "rgba(249,115,22,0.9)"}22`,
                        color: GRADE_COLOR[brand.grade] ?? "#fb923c",
                        border: `1px solid ${GRADE_COLOR[brand.grade] ?? "#fb923c"}44`,
                      }}>
                        {brand.grade}
                      </span>
                      {isSaved && (
                        <span
                          data-testid={`saved-badge-${brand.brand}`}
                          style={{
                            padding: "1px 7px", borderRadius: 999, fontSize: 11, fontWeight: 700,
                            background: "rgba(249,115,22,0.15)",
                            color: "#fb923c",
                            border: "1px solid rgba(249,115,22,0.35)",
                          }}
                        >
                          ★ Saved
                        </span>
                      )}
                    </div>
                    <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, lineHeight: 1.4 }}>
                      {brand.reason}
                    </div>
                  </div>
                  <PillButton
                    active={isSaved}
                    variant="amber"
                    onClick={() => onSave(a.ingredient, a.category, brand)}
                    disabled={isSaved || isSaving}
                    style={{ flexShrink: 0, alignSelf: "flex-start", marginTop: 2 }}
                  >
                    {isSaved ? "Saved ✓" : isSaving ? "Saving…" : "Save"}
                  </PillButton>
                </div>
              );
            })}
          </div>

          {/* Avoid */}
          {a.avoid.length > 0 && (
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
              {a.avoid.map((av) => (
                <div
                  key={av.brand}
                  style={{
                    display: "flex", alignItems: "flex-start", gap: 10,
                    padding: "8px 12px", borderRadius: 10,
                    background: "rgba(239,68,68,0.07)",
                    border: "1px solid rgba(239,68,68,0.18)",
                  }}
                >
                  <XCircle style={{ width: 15, height: 15, color: "#ef4444", flexShrink: 0, marginTop: 1 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ color: "rgba(255,255,255,0.8)", fontWeight: 600, fontSize: 13 }}>{av.brand}</span>
                    <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}> — {av.reason}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </>
  );
}

interface SmartCartAdviceBodyProps {
  advice: IngredientAdvice[];
  savedProductKeys: Set<string>;
  savingKey: string | null;
  onSave: (ingredient: string, category: string, brand: BrandRecommendation) => void;
}
