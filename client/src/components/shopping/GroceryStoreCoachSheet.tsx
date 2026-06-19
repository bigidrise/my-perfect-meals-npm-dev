import { useState, useRef, useEffect, useCallback } from "react";
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
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { post } from "@/lib/api";
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
  shoppingList: ShoppingListItem[];
  followUpSuggestions: string[];
  servingCount: number;
}

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
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

  const [phase, setPhase] = useState<Phase>("idle");
  const [servingCount, setServingCount] = useState(1);
  const [input, setInput] = useState("");
  const [result, setResult] = useState<CoachResult | null>(null);
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0]);
  const [addedToList, setAddedToList] = useState(false);
  const [listExpanded, setListExpanded] = useState(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const loadingInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!open) {
      setPhase("idle");
      setInput("");
      setResult(null);
      setConversation([]);
      setAddedToList(false);
      setListExpanded(true);
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

  const sendMessage = useCallback(async (msg: string) => {
    if (!msg.trim()) return;
    const userMsg = msg.trim();
    setInput("");
    setPhase("loading");
    setAddedToList(false);

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
      setResult(data as CoachResult);
      setPhase("result");
      setListExpanded(true);
    } catch (err: any) {
      setPhase("idle");
      toast({
        title: "Coach unavailable",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
      setConversation(newConvo.slice(0, -1));
    }
  }, [conversation, servingCount, toast]);

  const handleAddToList = useCallback(() => {
    if (!result?.shoppingList?.length) return;
    const items: UniversalIngredient[] = result.shoppingList.map((s) => ({
      name: s.item,
      quantity: parseFloat(s.quantity) || 1,
      unit: s.unit || "",
      sourceMeals: [result.meal?.name || "Grocery Coach"],
    }));
    addItems(items);
    setAddedToList(true);
    toast({ title: "Added to shopping list!", description: `${items.length} items added.` });
  }, [result, addItems, toast]);

  const handleGenerateAnother = useCallback(() => {
    sendMessage("Give me a different option");
  }, [sendMessage]);

  const handleSubmit = useCallback(() => {
    sendMessage(input);
  }, [input, sendMessage]);

  const groupedList = result ? groupByCategory(result.shoppingList || []) : {};
  const sortedCategories = MACRO_CATEGORY_ORDER.filter((c) => groupedList[c]);
  const otherCategories = Object.keys(groupedList).filter((c) => !MACRO_CATEGORY_ORDER.includes(c));

  if (!open) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(0,0,0,0.7)" }}
        onClick={() => onOpenChange(false)}
      />

      {/* Panel — flex column: header | scroll body | sticky input footer */}
      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
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
        {/* ── Header (never scrolls) ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 16px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }}>
          <div style={{ padding: 8, borderRadius: 12, background: "rgba(234,88,12,0.2)", border: "1px solid rgba(249,115,22,0.3)" }}>
            <ChefHat style={{ width: 20, height: 20, color: "#fb923c" }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: "white", fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>Grocery Store Coach</div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>Decide what to make. Know what to buy.</div>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            style={{ padding: 8, borderRadius: 12, background: "rgba(255,255,255,0.05)", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* ── Scrollable body (shrinks when keyboard opens) ── */}
        <div style={{ flex: 1, overflowY: "auto", overscrollBehavior: "contain", minHeight: 0 }}>
          <AnimatePresence mode="wait">

            {/* ── IDLE ── */}
            {phase === "idle" && (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ padding: 16, display: "flex", flexDirection: "column", gap: 20, paddingBottom: 16 }}
              >
                {/* Serving count */}
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

                {/* Quick starts */}
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
                  <div style={{ color: "#fb923c", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
                    Tonight's Recommendation
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
                                    <div key={i} style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, fontSize: 14 }}>
                                      <span style={{ color: "rgba(255,255,255,0.85)", lineHeight: 1.3 }}>{s.item}</span>
                                      <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, flexShrink: 0 }}>{s.quantity} {s.unit}</span>
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

                {/* Action buttons */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
                  <button
                    onClick={handleGenerateAnother}
                    style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px 0", borderRadius: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
                  >
                    <RefreshCw style={{ width: 16, height: 16 }} />
                    Try a Different Meal
                  </button>
                </div>

                {/* Refine chips — inside scroll body, above sticky input */}
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

        {/* ── Sticky input footer — always visible above keyboard ── */}
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
    </>,
    document.body
  );
}
