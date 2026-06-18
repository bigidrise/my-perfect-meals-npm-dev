import { useState, useRef, useEffect, useCallback } from "react";
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
import { Sheet, SheetContent } from "@/components/ui/sheet";
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="p-0 border-0 bg-transparent max-h-[92dvh] flex flex-col rounded-t-2xl overflow-hidden"
      >
        {/* Dark background */}
        <div className="flex flex-col h-full bg-gradient-to-b from-black/95 to-black/98 border border-orange-500/30 rounded-t-2xl overflow-hidden">

          {/* Header — never scrolls */}
          <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-white/10 shrink-0">
            <div className="p-2 rounded-xl bg-orange-600/20 border border-orange-500/30">
              <ChefHat className="h-5 w-5 text-orange-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-white font-bold text-base leading-tight">Grocery Store Coach</h2>
              <p className="text-white/50 text-xs">Decide what to make. Know what to buy.</p>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="p-2 rounded-xl bg-white/5 text-white/50 active:bg-white/10 transition-all"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            <AnimatePresence mode="wait">

              {/* ── IDLE ── */}
              {phase === "idle" && (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="p-4 space-y-5 pb-10"
                >
                  {/* Serving count */}
                  <div>
                    <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-2">
                      How many people?
                    </p>
                    <div className="flex items-center gap-3 mb-2.5">
                      <button
                        onClick={() => setServingCount((n) => Math.max(1, n - 1))}
                        disabled={servingCount <= 1}
                        className="w-10 h-10 rounded-full bg-white/8 border border-white/10 text-white/70 disabled:opacity-30 flex items-center justify-center active:scale-90 transition-all"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <div className="flex-1 text-center">
                        <span className="text-3xl font-bold text-white">{servingCount}</span>
                        <p className="text-white/40 text-xs mt-0.5">
                          {servingCount === 1 ? "Just me" : servingCount === 2 ? "2 people" : `${servingCount} people`}
                        </p>
                      </div>
                      <button
                        onClick={() => setServingCount((n) => Math.min(12, n + 1))}
                        disabled={servingCount >= 12}
                        className="w-10 h-10 rounded-full bg-white/8 border border-white/10 text-white/70 disabled:opacity-30 flex items-center justify-center active:scale-90 transition-all"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex gap-1.5">
                      {[1, 2, 3, 4, 5, 6].map((n) => (
                        <button
                          key={n}
                          onClick={() => setServingCount(n)}
                          className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${
                            servingCount === n
                              ? "bg-orange-600 text-white border-orange-500"
                              : "bg-white/5 text-white/50 border-white/10 active:bg-white/10"
                          }`}
                        >
                          {n === 1 ? "Me" : n}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Quick starts */}
                  <div>
                    <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-2">
                      Quick start
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {QUICK_STARTS.map((chip) => (
                        <button
                          key={chip}
                          onClick={() => sendMessage(chip)}
                          className="px-3 py-2 rounded-full bg-white/5 border border-white/10 text-white/70 text-sm font-medium active:bg-orange-600/20 active:border-orange-500/30 active:text-orange-300 transition-all"
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Text input */}
                  <div>
                    <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-2">
                      Or describe what you're feeling
                    </p>
                    <div className="flex gap-2">
                      <textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSubmit();
                          }
                        }}
                        placeholder="e.g. I have no idea what I want for dinner…"
                        rows={2}
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/30 resize-none focus:outline-none focus:border-orange-500/50"
                      />
                      <button
                        onClick={handleSubmit}
                        disabled={!input.trim()}
                        className="px-4 rounded-xl bg-orange-600 disabled:bg-white/10 disabled:text-white/30 text-white transition-all active:scale-95"
                      >
                        <Send className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── LOADING ── */}
              {phase === "loading" && (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center py-20 px-4 gap-5"
                >
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full bg-orange-600/20 border-2 border-orange-500/30 flex items-center justify-center">
                      <ChefHat className="h-7 w-7 text-orange-400" />
                    </div>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                      className="absolute inset-0 rounded-full border-2 border-transparent border-t-orange-500"
                    />
                  </div>
                  <motion.p
                    key={loadingMsg}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="text-white/70 text-sm text-center font-medium"
                  >
                    {loadingMsg}
                  </motion.p>
                </motion.div>
              )}

              {/* ── RESULT ── */}
              {phase === "result" && result && (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="p-4 space-y-4 pb-10"
                >
                  {/* Meal recommendation card */}
                  <div className="rounded-xl bg-gradient-to-br from-orange-600/20 to-orange-900/20 border border-orange-500/30 p-4">
                    <p className="text-orange-400 text-xs font-bold uppercase tracking-wider mb-1">
                      Tonight's Recommendation
                    </p>
                    <h3 className="text-white font-bold text-xl leading-tight">
                      {result.meal?.name || "Your Personalized Meal"}
                    </h3>
                    <p className="text-white/70 text-sm mt-2 leading-relaxed">
                      {result.meal?.description}
                    </p>
                    <div className="flex items-center gap-4 mt-3">
                      <span className="flex items-center gap-1.5 text-sm text-white/50">
                        <Clock className="h-4 w-4" />
                        {result.meal?.prepTime || "~30 min"}
                      </span>
                      <span className="flex items-center gap-1.5 text-sm text-white/50">
                        <Users className="h-4 w-4" />
                        {result.servingCount || result.meal?.servings || 1}{" "}
                        {(result.servingCount || result.meal?.servings || 1) === 1 ? "serving" : "servings"}
                      </span>
                    </div>
                  </div>

                  {/* Macros — 2×2 grid, works on smallest iPhone */}
                  {result.macros && (
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: "Calories", value: result.macros.calories, unit: "" },
                        { label: "Protein", value: result.macros.protein, unit: "g" },
                        { label: "Carbs", value: result.macros.carbs, unit: "g" },
                        { label: "Fat", value: result.macros.fat, unit: "g" },
                      ].map(({ label, value, unit }) => (
                        <div
                          key={label}
                          className="rounded-xl bg-white/5 border border-white/10 p-3 text-center"
                        >
                          <p className="text-white font-bold text-lg leading-none">
                            {value ?? "—"}{unit}
                          </p>
                          <p className="text-white/50 text-xs mt-1 font-medium">{label}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Why This Fits You */}
                  {result.reasoning?.length > 0 && (
                    <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                      <p className="text-white/50 text-xs font-bold uppercase tracking-wider mb-3">
                        Why This Fits You
                      </p>
                      <ul className="space-y-2.5">
                        {result.reasoning.map((r, i) => (
                          <li key={i} className="flex items-start gap-2.5 text-sm text-white/80">
                            <CheckCircle2 className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
                            <span className="leading-snug">{r}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Shopping List */}
                  {result.shoppingList?.length > 0 && (
                    <div className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
                      <button
                        onClick={() => setListExpanded((v) => !v)}
                        className="w-full flex items-center justify-between px-4 py-3.5 text-left active:bg-white/5"
                      >
                        <div className="flex items-center gap-2">
                          <ShoppingCart className="h-4 w-4 text-orange-400" />
                          <span className="text-white font-semibold text-sm">
                            Shopping List
                          </span>
                          <span className="text-white/40 text-xs">
                            ({result.shoppingList.length} items)
                          </span>
                        </div>
                        {listExpanded
                          ? <ChevronUp className="h-4 w-4 text-white/40" />
                          : <ChevronDown className="h-4 w-4 text-white/40" />
                        }
                      </button>

                      <AnimatePresence initial={false}>
                        {listExpanded && (
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: "auto" }}
                            exit={{ height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="px-4 pb-4 space-y-4">
                              {[...sortedCategories, ...otherCategories].map((cat) => (
                                <div key={cat}>
                                  <p className="text-orange-400/70 text-[11px] font-bold uppercase tracking-wider mb-2">
                                    {cat}
                                  </p>
                                  <ul className="space-y-2">
                                    {groupedList[cat].map((s, i) => (
                                      <li key={i} className="flex items-start justify-between gap-3 text-sm">
                                        <span className="text-white/85 leading-snug">{s.item}</span>
                                        <span className="text-white/45 text-xs shrink-0 pt-0.5">
                                          {s.quantity} {s.unit}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={handleAddToList}
                      disabled={addedToList}
                      className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl font-semibold text-base transition-all active:scale-95 ${
                        addedToList
                          ? "bg-emerald-600/20 border border-emerald-500/30 text-emerald-400"
                          : "bg-orange-600 text-white"
                      }`}
                    >
                      {addedToList ? (
                        <><CheckCircle2 className="h-5 w-5" /> Added to List!</>
                      ) : (
                        <><ShoppingCart className="h-5 w-5" /> Add All to Shopping List</>
                      )}
                    </button>
                    <button
                      onClick={handleGenerateAnother}
                      className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white/70 text-sm font-semibold active:scale-95 transition-all"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Try a Different Meal
                    </button>
                  </div>

                  {/* Refine */}
                  <div>
                    <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-2">
                      Refine this recommendation
                    </p>
                    {result.followUpSuggestions?.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {result.followUpSuggestions.map((chip) => (
                          <button
                            key={chip}
                            onClick={() => sendMessage(chip)}
                            className="px-3 py-2 rounded-full bg-white/5 border border-white/10 text-white/60 text-sm font-medium active:bg-orange-600/20 active:border-orange-500/30 active:text-orange-300 transition-all"
                          >
                            {chip}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSubmit();
                          }
                        }}
                        placeholder="Make it cheaper… faster… vegetarian…"
                        rows={2}
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/30 resize-none focus:outline-none focus:border-orange-500/50"
                      />
                      <button
                        onClick={handleSubmit}
                        disabled={!input.trim()}
                        className="px-4 rounded-xl bg-orange-600 disabled:bg-white/10 disabled:text-white/30 text-white transition-all active:scale-95"
                      >
                        <Send className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
