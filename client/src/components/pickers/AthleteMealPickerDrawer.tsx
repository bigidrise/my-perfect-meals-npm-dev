import React from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { UniversalDialog } from "@/components/ui/universal-modal";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Meal } from "@/components/MealCard";
import {
  getAthleteMealsByCategory,
  type AthleteMeal,
} from "@/data/athleteMeals";
import { Target, Copy, Check, Send, Loader2, MessageSquare } from "lucide-react";
import { getResolvedTargets } from "@/lib/macroResolver";
import { apiRequest } from "@/lib/queryClient";

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// 🔄 Convert AthleteMeal to standard Meal
function convertAthleteMealToMeal(athleteMeal: AthleteMeal): Meal {
  const ingredients = [
    {
      item: athleteMeal.protein_source,
      amount: `${athleteMeal.protein_oz} oz`,
    },
    ...(athleteMeal.carb_source
      ? [{ item: athleteMeal.carb_source, amount: `${athleteMeal.carb_g}g` }]
      : []),
    ...athleteMeal.fibrous_source.map((veg: string) => ({
      item: veg,
      amount: "1 cup",
    })),
  ];

  const instructions = [
    `Grill or bake ${athleteMeal.protein_source} (${athleteMeal.protein_oz}oz)`,
    ...(athleteMeal.carb_source
      ? [`Prepare ${athleteMeal.carb_source} (${athleteMeal.carb_g}g)`]
      : []),
    ...(athleteMeal.fibrous_source.length
      ? [`Steam or grill ${athleteMeal.fibrous_source.join(", ")}`]
      : []),
    "Season to taste with low-sodium options",
  ];

  // Stable ID based on meal content
  const stableId = simpleHash(`athlete_${athleteMeal.id}_${athleteMeal.title}`);

  const totalCarbs = athleteMeal.macros.starchyCarbs + athleteMeal.macros.fibrousCarbs;

  return {
    id: `athlete_${stableId.toString(36)}`,
    title: athleteMeal.title,
    servings: 1,
    ingredients,
    instructions,
    nutrition: {
      calories: athleteMeal.macros.kcal,
      protein: athleteMeal.macros.protein,
      carbs: totalCarbs,
      fat: athleteMeal.macros.fat,
    },
    starchyCarbs: athleteMeal.macros.starchyCarbs,
    badges: athleteMeal.tags,
  };
}

const DEFAULT_CATEGORY = "poultry";

const CATEGORY_OPTIONS = [
  { value: "poultry", emoji: "🐔", labelKey: "athletePicker.categories.poultry" },
  { value: "redmeat", emoji: "🥩", labelKey: "athletePicker.categories.redmeat" },
  { value: "fish", emoji: "🐟", labelKey: "athletePicker.categories.fish" },
  { value: "eggs_shakes", emoji: "🥚", labelKey: "athletePicker.categories.eggsShakes" },
] as const;

type SlotKey = "breakfast" | "lunch" | "dinner" | "snacks" | "meal4" | "meal5" | "meal6";

const SLOT_OPTIONS: { value: SlotKey; labelKey: string }[] = [
  { value: "breakfast", labelKey: "athletePicker.slots.breakfast" },
  { value: "lunch", labelKey: "athletePicker.slots.lunch" },
  { value: "dinner", labelKey: "athletePicker.slots.dinner" },
  { value: "snacks", labelKey: "athletePicker.slots.snacks" },
  { value: "meal4", labelKey: "athletePicker.slots.meal4" },
  { value: "meal5", labelKey: "athletePicker.slots.meal5" },
  { value: "meal6", labelKey: "athletePicker.slots.meal6" },
];

export function AthleteMealPickerDrawer({
  open,
  list,
  onClose,
  onPick,
  carbCycleState,
  carbsUsed,
  macroTargets,
  userId,
  hasCoachLink,
}: {
  open: boolean;
  list: SlotKey | null;
  onClose: () => void;
  onPick: (meal: Meal, slot: SlotKey) => void;
  carbCycleState?: { phase: string; carbTargetG: number } | null;
  carbsUsed?: number;
  macroTargets?: { calories: number; protein_g: number; carbs_g: number; fat_g: number } | null;
  userId?: string;
  hasCoachLink?: boolean;
}) {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const [category, setCategory] =
    React.useState<AthleteMeal["category"]>(DEFAULT_CATEGORY);
  const [showInfoModal, setShowInfoModal] = React.useState(false);
  const [lastAddedId, setLastAddedId] = React.useState<string | null>(null);
  const [sessionCount, setSessionCount] = React.useState(0);
  const [sessionMacros, setSessionMacros] = React.useState({ cals: 0, protein: 0, carbs: 0, fat: 0 });
  const [activeList, setActiveList] = React.useState<SlotKey | null>(list);
  const [copied, setCopied] = React.useState(false);
  const [copiedMealId, setCopiedMealId] = React.useState<string | null>(null);
  const [liveTargets, setLiveTargets] = React.useState<
    { calories: number; protein_g: number; carbs_g: number; fat_g: number } | null | undefined
  >(macroTargets);
  const [sendState, setSendState] = React.useState<"idle" | "sending" | "sent" | "error">("idle");
  const [sendError, setSendError] = React.useState<string | null>(null);

  // Sync liveTargets when the prop changes (e.g. drawer reopens with fresh data)
  React.useEffect(() => {
    setLiveTargets(macroTargets);
  }, [macroTargets]);

  // Re-read resolved targets whenever a coach pushes an update mid-session
  React.useEffect(() => {
    function handleTargetsUpdated() {
      const resolved = getResolvedTargets(userId);
      if (resolved.source !== "none") {
        setLiveTargets({
          calories: resolved.calories,
          protein_g: resolved.protein_g,
          carbs_g: resolved.carbs_g,
          fat_g: resolved.fat_g,
        });
      }
    }
    window.addEventListener("mpm:targetsUpdated", handleTargetsUpdated);
    return () => window.removeEventListener("mpm:targetsUpdated", handleTargetsUpdated);
  }, [userId]);

  const isCycleActive = carbCycleState?.phase === "low_carb" || carbCycleState?.phase === "refeed";
  const carbCap = isCycleActive ? (carbCycleState?.carbTargetG ?? 0) : 0;
  const carbCapSoft = Math.round(carbCap * 1.2);
  const budgetPct = isCycleActive && carbCap > 0 && typeof carbsUsed === "number"
    ? Math.min(100, Math.round((carbsUsed / carbCap) * 100))
    : null;

  // When drawer opens, sync activeList to the incoming list prop and reset category/flash/count/macros
  React.useEffect(() => {
    if (open) {
      setActiveList(list);
      setCategory(DEFAULT_CATEGORY);
      setLastAddedId(null);
      setSessionCount(0);
      setSessionMacros({ cals: 0, protein: 0, carbs: 0, fat: 0 });
      setCopied(false);
      setCopiedMealId(null);
      setSendState("idle");
      setSendError(null);
    }
  }, [open, list]);

  function buildSummaryText() {
    return t("athletePicker.summaryText", {
      count: sessionCount,
      cals: sessionMacros.cals.toLocaleString(),
      protein: sessionMacros.protein,
      carbs: sessionMacros.carbs,
      fat: sessionMacros.fat,
    });
  }

  function handleCopySession() {
    navigator.clipboard.writeText(buildSummaryText()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function handleCopyMeal(e: React.MouseEvent, am: AthleteMeal) {
    e.stopPropagation();
    const starch = am.macros.starchyCarbs;
    const text = t("athletePicker.mealCopyText", {
      title: am.title,
      cals: am.macros.kcal,
      protein: am.macros.protein,
      starch,
      fat: am.macros.fat,
    });
    navigator.clipboard.writeText(text).then(() => {
      setCopiedMealId(am.id);
      setTimeout(() => setCopiedMealId((prev) => prev === am.id ? null : prev), 1500);
    });
  }

  async function handleSendToCoach() {
    if (sendState === "sending" || sendState === "sent") return;
    setSendState("sending");
    setSendError(null);
    try {
      await apiRequest("/api/client/tablet/message", {
        method: "POST",
        body: JSON.stringify({ body: buildSummaryText() }),
        headers: { "Content-Type": "application/json" },
      });
      setSendState("sent");
      setTimeout(() => setSendState("idle"), 6000);
    } catch (err: any) {
      const msg = err?.message || "Failed to send";
      setSendError(msg.includes("No active") ? t("athletePicker.noCoachConnection") : t("athletePicker.sendFailed"));
      setSendState("error");
      setTimeout(() => { setSendState("idle"); setSendError(null); }, 3000);
    }
  }

  function handleViewInChat() {
    sessionStorage.setItem("mpm.openClientChat", "1");
    onClose();
    navigate("/");
  }

  // Filter meals by selected category, excluding any where adding the meal's STARCH
  // would push cumulative starch more than 20% over the starch cap.
  // Fibrous carbs (vegetables) are never counted against the starch allocation.
  const filteredMeals = React.useMemo(() => {
    const all = getAthleteMealsByCategory(category);
    if (!isCycleActive || carbCap <= 0) return all;
    const used = carbsUsed ?? 0;
    return all.filter((am: AthleteMeal) => {
      const mealStarch = am.macros.starchyCarbs;
      return used + mealStarch <= carbCapSoft;
    });
  }, [category, isCycleActive, carbCap, carbCapSoft, carbsUsed]);

  const excludedCount = React.useMemo(() => {
    if (!isCycleActive || carbCap <= 0) return 0;
    const used = carbsUsed ?? 0;
    return getAthleteMealsByCategory(category).filter((am: AthleteMeal) => {
      const mealStarch = am.macros.starchyCarbs;
      return used + mealStarch > carbCapSoft;
    }).length;
  }, [category, isCycleActive, carbCap, carbCapSoft, carbsUsed]);

  if (!open || !list) return null;

  const slotLabelKey = SLOT_OPTIONS.find((s) => s.value === activeList)?.labelKey;
  const slotLabel = slotLabelKey ? t(slotLabelKey) : activeList;

  return (
    <>
    <UniversalDialog
      open={open}
      onOpenChange={(v) => !v && onClose()}
      rawLayout
      className="bg-black/90 border-white/20 text-white max-w-4xl max-h-[85vh] overflow-y-auto"
    >
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="text-2xl font-bold text-white flex items-center gap-2">
              🏆 {t("athletePicker.headerTitle", { slot: slotLabel })}
              <button
                onClick={() => setShowInfoModal(true)}
                className="bg-lime-700 hover:bg-lime-800 border-2 border-lime-600 text-white rounded-xl w-5 h-5 flex items-center justify-center text-sm font-bold flash-border"
                aria-label={t("athletePicker.howToAria")}
              >
                ?
              </button>
              {sessionCount > 0 && (
                <span className="bg-lime-700/80 text-white text-xs font-semibold px-2.5 py-0.5 rounded-full">
                  {t("athletePicker.addedCount", { count: sessionCount })}
                </span>
              )}
            </DialogTitle>
            <button
              onClick={onClose}
              className="shrink-0 bg-orange-600 text-white text-sm font-semibold px-4 py-1.5 rounded-xl"
            >
              {t("athletePicker.done")}
            </button>
          </div>
          {sessionCount > 0 && (
            <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
              <span className="text-white/40 text-xs font-medium">{t("athletePicker.sessionTotal")}</span>
              {(() => {
                const hasTargets = liveTargets && (
                  liveTargets.calories > 0 || liveTargets.protein_g > 0 ||
                  liveTargets.carbs_g > 0 || liveTargets.fat_g > 0
                );

                function pillColor(value: number, target: number): string {
                  if (!target) return "bg-white/10 text-white/90";
                  const pct = value / target;
                  if (pct > 1) return "bg-red-700/70 text-red-100";
                  if (pct >= 0.9) return "bg-amber-600/70 text-amber-100";
                  return "bg-lime-800/60 text-lime-100";
                }

                if (hasTargets) {
                  return (
                    <>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${pillColor(sessionMacros.cals, liveTargets!.calories)}`}>
                        {sessionMacros.cals.toLocaleString()} / {liveTargets!.calories.toLocaleString()} cal
                      </span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${pillColor(sessionMacros.protein, liveTargets!.protein_g)}`}>
                        P {sessionMacros.protein} / {liveTargets!.protein_g}g
                      </span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${pillColor(sessionMacros.carbs, liveTargets!.carbs_g)}`}>
                        C {sessionMacros.carbs} / {liveTargets!.carbs_g}g
                      </span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${pillColor(sessionMacros.fat, liveTargets!.fat_g)}`}>
                        F {sessionMacros.fat} / {liveTargets!.fat_g}g
                      </span>
                    </>
                  );
                }

                return (
                  <>
                    <span className="bg-white/10 text-white/90 text-xs font-semibold px-2 py-0.5 rounded-full">
                      {sessionMacros.cals.toLocaleString()} cal
                    </span>
                    <span className="bg-white/10 text-white/90 text-xs font-semibold px-2 py-0.5 rounded-full">
                      P {sessionMacros.protein}g
                    </span>
                    <span className="bg-white/10 text-white/90 text-xs font-semibold px-2 py-0.5 rounded-full">
                      C {sessionMacros.carbs}g
                    </span>
                    <span className="bg-white/10 text-white/90 text-xs font-semibold px-2 py-0.5 rounded-full">
                      F {sessionMacros.fat}g
                    </span>
                  </>
                );
              })()}
              <button
                onClick={handleCopySession}
                className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full transition-all ${
                  copied
                    ? "bg-lime-700/80 text-white"
                    : "bg-white/10 text-white/70 active:bg-white/20"
                }`}
                aria-label={t("athletePicker.copySessionAria")}
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3" />
                    {t("athletePicker.copied")}
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    {t("athletePicker.copy")}
                  </>
                )}
              </button>
              {hasCoachLink && (
                <>
                  <button
                    onClick={handleSendToCoach}
                    disabled={sendState === "sending" || sendState === "sent"}
                    className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full transition-all ${
                      sendState === "sent"
                        ? "bg-lime-700/80 text-white"
                        : sendState === "error"
                        ? "bg-red-700/70 text-red-100"
                        : sendState === "sending"
                        ? "bg-orange-700/60 text-orange-100"
                        : "bg-orange-600/70 text-white active:bg-orange-600"
                    }`}
                    aria-label={t("athletePicker.sendCoachAria")}
                  >
                    {sendState === "sending" ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        {t("athletePicker.sending")}
                      </>
                    ) : sendState === "sent" ? (
                      <>
                        <Check className="h-3 w-3" />
                        {t("athletePicker.sent")}
                      </>
                    ) : sendState === "error" ? (
                      <>
                        <Send className="h-3 w-3" />
                        {sendError ?? t("athletePicker.errorShort")}
                      </>
                    ) : (
                      <>
                        <Send className="h-3 w-3" />
                        {t("athletePicker.sendToCoach")}
                      </>
                    )}
                  </button>
                  {sendState === "sent" && (
                    <button
                      onClick={handleViewInChat}
                      className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-white/15 text-white active:bg-white/25 transition-all"
                      aria-label={t("athletePicker.viewChatAria")}
                    >
                      <MessageSquare className="h-3 w-3" />
                      {t("athletePicker.viewInChat")}
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </DialogHeader>

        <div className="space-y-4">
          {/* Slot Switcher */}
          <div className="bg-black/30 p-3 rounded-lg border border-white/10">
            <p className="text-white/60 text-xs mb-2 font-medium">{t("athletePicker.addingTo")}</p>
            <div className="flex flex-wrap gap-2">
              {SLOT_OPTIONS.map((slot) => (
                <button
                  key={slot.value}
                  onClick={() => setActiveList(slot.value)}
                  className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-all ${
                    activeList === slot.value
                      ? "bg-orange-600 text-white"
                      : "bg-white/10 text-white/70"
                  }`}
                >
                  {t(slot.labelKey)}
                </button>
              ))}
            </div>
          </div>

          {/* Starch Allocation Bar — shown when starch cycle is active */}
          {isCycleActive && carbCap > 0 && (
            <div className={`p-3 rounded-xl border ${carbCycleState?.phase === "refeed" ? "bg-green-950/30 border-green-500/30" : "bg-orange-950/30 border-orange-500/30"}`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-xs font-semibold ${carbCycleState?.phase === "refeed" ? "text-green-300" : "text-orange-300"}`}>
                  {carbCycleState?.phase === "refeed" ? `⚡ ${t("athletePicker.refeedDay")}` : `🔄 ${t("athletePicker.lowStarchDay")}`} — {t("athletePicker.starchAllocation")}
                </span>
                <span className="text-white/60 text-xs font-semibold">
                  {budgetPct !== null ? t("athletePicker.starchUsage", { used: carbsUsed, cap: carbCap }) : t("athletePicker.starchCap", { cap: carbCap })}
                </span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${carbCycleState?.phase === "refeed" ? "bg-green-400" : "bg-orange-400"}`}
                  style={{ width: budgetPct !== null ? `${budgetPct}%` : "0%" }}
                />
              </div>
              <p className="text-white/40 text-xs mt-1.5">
                {t("athletePicker.fibrousNote")}
              </p>
            </div>
          )}

          {/* Category Selector */}
          <div className="bg-black/30 p-4 rounded-lg border border-white/10">
            <label className="text-white/80 text-sm mb-2 block">{t("athletePicker.selectCategory")}</label>
            <Select
              value={category}
              onValueChange={(val) =>
                setCategory(val as AthleteMeal["category"])
              }
            >
              <SelectTrigger className="w-full bg-black/60 border-white/20 text-white h-10 text-sm">
                <SelectValue>
                  {(() => {
                    const opt = CATEGORY_OPTIONS.find((o) => o.value === category);
                    return opt ? `${opt.emoji} ${t(opt.labelKey)}` : t("athletePicker.selectCategoryShort");
                  })()}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-zinc-900/95 border-white/20 text-white">
                {CATEGORY_OPTIONS.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    className="text-white hover:bg-white/10 focus:bg-white/20 cursor-pointer"
                  >
                    {`${option.emoji} ${t(option.labelKey)}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Meal Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {filteredMeals.map((am: AthleteMeal) => {
              const mealStarch = am.macros.starchyCarbs;
              const mealFibrous = am.macros.fibrousCarbs;
              const justAdded = lastAddedId === am.id;
              return (
                <button
                  key={am.id}
                  onClick={() => {
                    if (!activeList) return;
                    const mealToAdd = convertAthleteMealToMeal(am);
                    onPick(mealToAdd, activeList);
                    setSessionCount((c) => c + 1);
                    setSessionMacros((prev) => ({
                      cals: prev.cals + (mealToAdd.nutrition?.calories ?? 0),
                      protein: prev.protein + (mealToAdd.nutrition?.protein ?? 0),
                      carbs: prev.carbs + (mealToAdd.nutrition?.carbs ?? 0),
                      fat: prev.fat + (mealToAdd.nutrition?.fat ?? 0),
                    }));
                    setLastAddedId(am.id);
                    setTimeout(() => setLastAddedId((prev) => prev === am.id ? null : prev), 1500);
                  }}
                  className={`w-full text-left rounded-xl border p-4 transition-all ${
                    justAdded
                      ? "border-lime-500/60 bg-lime-900/30"
                      : "border-white/20 bg-black/50 active:bg-white/10"
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="text-white/90 font-medium text-sm flex-1 leading-tight">
                      {am.title.includes('(') ? (
                        <>
                          {am.title.split('(')[0].trim()}
                          <br />
                          <span className="text-xs text-white/70">({am.title.split('(')[1]}</span>
                        </>
                      ) : (
                        am.title
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 ml-2 shrink-0">
                      {justAdded ? (
                        <Badge className="bg-lime-600/90 text-white text-[10px] px-2 py-0.5">
                          {t("athletePicker.added")}
                        </Badge>
                      ) : am.includeCarbs ? (
                        <Badge className="bg-green-600/80 text-white text-[10px] px-2 py-0.5">
                          {t("athletePicker.starch")}
                        </Badge>
                      ) : (
                        <Badge className="bg-orange-600/80 text-white text-[10px] px-2 py-0.5">
                          P+V
                        </Badge>
                      )}
                      <button
                        onClick={(e) => handleCopyMeal(e, am)}
                        className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white/10 text-white/50 hover:bg-white/20 hover:text-white/80 transition-all text-[9px] font-medium"
                        aria-label={t("athletePicker.copyMealAria")}
                      >
                        {copiedMealId === am.id ? (
                          <Check className="h-2.5 w-2.5 text-lime-400" />
                        ) : (
                          <Copy className="h-2.5 w-2.5" />
                        )}
                        <span>{copiedMealId === am.id ? t("athletePicker.copied") : t("athletePicker.copy")}</span>
                      </button>
                    </div>
                  </div>

                  <div className="text-white/70 text-xs mb-1 leading-tight">
                    {am.protein_source} ({am.protein_oz}oz)
                    {am.carb_source && ` • ${am.carb_source} (${am.carb_g}g)`}
                  </div>

                  <div className="text-white/90 text-xs font-semibold leading-tight">
                    {am.macros.kcal} kcal · P{am.macros.protein} · S{mealStarch}
                    {mealFibrous > 0 ? ` · V${mealFibrous}` : ""} · F{am.macros.fat}
                  </div>

                  {am.tags?.length ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {am.tags.slice(0, 2).map((tag: string) => (
                        <span
                          key={tag}
                          className="text-[9px] bg-white/10 text-white/70 px-1.5 py-0.5 rounded-full leading-none"
                        >
                          {tag.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </button>
              );
            })}
            {excludedCount > 0 && (
              <p className="text-white/30 text-xs text-center col-span-full py-1">
                {t("athletePicker.hiddenCount", { count: excludedCount, cap: carbCapSoft })}
              </p>
            )}
          </div>

          {/* Info Note */}
          <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-lg p-4">
            <div className="flex items-start gap-2 mb-2">
              <Target className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-emerald-400 mb-1">{t("athletePicker.noteTitle")}</p>
                <p className="text-white/80 text-xs mb-2">
                  {t("athletePicker.noteDesc")}
                </p>
                <ul className="list-disc list-inside space-y-1 text-xs text-white/70 ml-2">
                  <li>{t("athletePicker.noteStep1")}</li>
                  <li>{t("athletePicker.noteStep2Before")} <strong className="text-white">{t("athletePicker.starch")}</strong> {t("athletePicker.noteStep2Mid")} <strong className="text-white">P+V</strong> {t("athletePicker.noteStep2After")}</li>
                  <li>{t("athletePicker.noteStep3")}</li>
                  <li>{t("athletePicker.noteStep4")}</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
    </UniversalDialog>

    {/* Info Modal */}
    {showInfoModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
        <div className="bg-black/30 backdrop-blur-lg border border-white/20 rounded-2xl p-6 max-w-md w-full shadow-xl">
          <h3 className="text-xl font-bold text-white mb-4">{t("athletePicker.info.title")}</h3>

          <div className="space-y-4 text-white/90 text-sm">
            <p>{t("athletePicker.info.intro")}</p>

            <div>
              <h4 className="font-semibold text-white mb-2">{t("athletePicker.info.stepsLabel")}</h4>
              <ul className="space-y-2 text-white/80 text-sm">
                <li><strong className="text-white">{t("athletePicker.info.step1Label")}</strong> {t("athletePicker.info.step1Text")}</li>
                <li><strong className="text-white">{t("athletePicker.starch")}</strong> {t("athletePicker.info.step2Mid")} <strong className="text-white">P+V</strong> {t("athletePicker.info.step2After")}</li>
                <li><strong className="text-white">{t("athletePicker.info.step3Label")}</strong> {t("athletePicker.info.step3Text")}</li>
                <li><strong className="text-white">{t("athletePicker.info.step4Label")}</strong> {t("athletePicker.info.step4Text")}</li>
              </ul>
            </div>

            <div className="bg-black/20 border border-white/10 rounded-lg p-3">
              <p className="font-semibold text-white mb-1">{t("athletePicker.info.tipLabel")}</p>
              <p className="text-white/70">
                {t("athletePicker.info.tipBefore")} <strong className="text-white">P+V</strong> {t("athletePicker.info.tipMid")} <strong className="text-white">{t("athletePicker.starch")}</strong> {t("athletePicker.info.tipAfter")}
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowInfoModal(false)}
            className="mt-6 w-full bg-lime-700 hover:bg-lime-800 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            {t("athletePicker.gotIt")}
          </button>
        </div>
      </div>
    )}
    </>
  );
}
