/**
 * AwayFromHomeMealCard
 *
 * The single shared UI component for all Meals Away From Home features.
 * Accepts only AwayFromHomeRecommendation — no feature-specific props.
 *
 * This card does not know whether the recommendation came from:
 *   - Restaurant Guide
 *   - Fast Food Guide
 *   - Find Meals Near Me
 *   - My Perfect Buffet
 *
 * Features rendered from the model:
 *   - Restaurant identity + match label
 *   - Meal name + description
 *   - Macro display with correct disclosure (official / estimated / mixed)
 *   - "How to Order" structured block
 *   - Medical waiter script
 *   - Protocol badges
 *   - Buffet plate breakdown
 *   - Language translation (all user-visible text fields)
 *   - Log to Macros / Add to Plan actions (via MacroConfirmSheet)
 */

import { useState } from "react";
import { ChefHat, MapPin, Star, Info, ShoppingBag, Utensils, Languages, RotateCcw, Loader2 } from "lucide-react";
import type {
  AwayFromHomeRecommendation,
  NutritionDataStatus,
  MedicalBadge,
} from "@shared/awayFromHome";
import { NUTRITION_DISCLOSURE } from "@shared/awayFromHome";
import { macroLabel } from "./awayFromHomeTranslator";
import MacroConfirmSheet from "./MacroConfirmSheet";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";

// ── Translation types ─────────────────────────────────────────────────────────

interface AFHTranslation {
  lang: string;
  langLabel: string;
  mealName: string;
  mealDescription: string;
  reason: string;
  askFor: string;
  modifications: string[];
  swaps: string[];
  waiterScript: string;
  buffetFoods: string[];
}

const TRANSLATE_LANGS = [
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "zh", label: "中文" },
  { code: "ja", label: "日本語" },
  { code: "pt", label: "Português" },
  { code: "ar", label: "العربية" },
  { code: "hi", label: "हिन्दी" },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function MacroCell({
  label,
  value,
  unit,
  status,
}: {
  label: string;
  value: number | undefined;
  unit: string;
  status: NutritionDataStatus;
}) {
  const display = macroLabel(value, status, unit);
  return (
    <div className="flex flex-col items-center">
      <span className="text-lg font-bold text-white leading-tight">{display}</span>
      <span className="text-[10px] text-white/50 uppercase tracking-wide">{label}</span>
    </div>
  );
}

function BadgePill({ badge }: { badge: MedicalBadge }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold",
        badge.compatible ? "bg-emerald-600/30 text-emerald-300" : "bg-red-600/30 text-red-300"
      )}
    >
      <span>{badge.compatible ? "✓" : "✕"}</span>
      {badge.condition}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5">{children}</p>
  );
}

function DisclosureRow({ status }: { status: NutritionDataStatus }) {
  const text = NUTRITION_DISCLOSURE[status];
  const color =
    status === "official"
      ? "text-white/40"
      : status === "mixed"
      ? "text-amber-400/70"
      : "text-orange-400/70";
  return (
    <div className={cn("flex items-start gap-1.5 text-[10px] leading-relaxed", color)}>
      <Info className="w-3 h-3 mt-0.5 shrink-0" />
      <span>{text}</span>
    </div>
  );
}

// ── Main Card ─────────────────────────────────────────────────────────────────

interface AwayFromHomeMealCardProps {
  recommendation: AwayFromHomeRecommendation;
  /** Optionally suppress actions (e.g., inside a preview or loading state). */
  actionsDisabled?: boolean;
  className?: string;
}

export default function AwayFromHomeMealCard({
  recommendation: rec,
  actionsDisabled = false,
  className,
}: AwayFromHomeMealCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Translation state
  const [translateOpen, setTranslateOpen] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translated, setTranslated] = useState<AFHTranslation | null>(null);

  const { meal, recommendation, protocol, nutritionStatus, buffetItems } = rec;

  // Use translated text when available, otherwise fall through to original
  const displayName = translated?.mealName || meal.name;
  const displayDescription = translated?.mealDescription || meal.description;
  const displayReason = translated?.reason || recommendation.reason;
  const displayAskFor = translated?.askFor || recommendation.howToOrder?.askFor;
  const displayModify = translated?.modifications || recommendation.howToOrder?.modify;
  const displaySwap = translated?.swaps || recommendation.howToOrder?.swap;
  const displayWaiterScript = translated?.waiterScript || recommendation.medicalWaiterScript;

  const hasHowToOrder =
    recommendation.howToOrder &&
    (recommendation.howToOrder.askFor ||
      recommendation.howToOrder.modify?.length ||
      recommendation.howToOrder.swap?.length);

  async function handleTranslate(langCode: string, langLabel: string) {
    if (translated?.lang === langCode) {
      setTranslateOpen(false);
      return;
    }
    setTranslating(true);
    setTranslateOpen(false);
    try {
      const content = {
        mealName: meal.name,
        mealDescription: meal.description || "",
        reason: recommendation.reason || "",
        askFor: recommendation.howToOrder?.askFor || "",
        modifications: recommendation.howToOrder?.modify || [],
        swaps: recommendation.howToOrder?.swap || [],
        waiterScript: recommendation.medicalWaiterScript || "",
        buffetFoods: buffetItems?.map((i) => i.food) || [],
      };
      const result = await apiRequest("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, targetLanguage: langCode }),
      });
      setTranslated({
        lang: langCode,
        langLabel,
        mealName: result.mealName || meal.name,
        mealDescription: result.mealDescription || "",
        reason: result.reason || "",
        askFor: result.askFor || "",
        modifications: Array.isArray(result.modifications) ? result.modifications : [],
        swaps: Array.isArray(result.swaps) ? result.swaps : [],
        waiterScript: result.waiterScript || "",
        buffetFoods: Array.isArray(result.buffetFoods) ? result.buffetFoods : [],
      });
    } catch {
      // Fall back silently — original text remains
    } finally {
      setTranslating(false);
    }
  }

  function handleSuccess(action: "logged" | "planned") {
    setSuccessMessage(
      action === "logged"
        ? "Logged to your macros."
        : "Added to your meal plan."
    );
    setTimeout(() => setSuccessMessage(null), 3000);
  }

  return (
    <>
      <div
        className={cn(
          "rounded-2xl overflow-hidden text-white",
          "bg-gradient-to-br from-black/80 via-orange-950/60 to-black/90",
          "border border-white/8 shadow-xl",
          className
        )}
      >
        {/* ── Restaurant header ─────────────────────────────────────── */}
        <div className="px-4 pt-4 pb-3 border-b border-white/6">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <MapPin className="w-3 h-3 text-orange-400 shrink-0" />
                <span className="text-sm font-semibold text-white truncate">
                  {rec.restaurantName}
                </span>
                {rec.restaurantCuisine && (
                  <span className="text-[10px] text-white/40">· {rec.restaurantCuisine}</span>
                )}
              </div>
              {rec.restaurantAddress && (
                <p className="text-[10px] text-white/40 mt-0.5 pl-4">{rec.restaurantAddress}</p>
              )}
              <div className="flex items-center gap-2 mt-1 pl-4 flex-wrap">
                {rec.restaurantRating != null && (
                  <span className="flex items-center gap-0.5 text-[10px] text-yellow-400">
                    <Star className="w-2.5 h-2.5 fill-yellow-400" />
                    {rec.restaurantRating.toFixed(1)}
                  </span>
                )}
                {rec.matchLabel && (
                  <span
                    className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full font-medium",
                      rec.matchLabel === "Exact match"
                        ? "bg-emerald-600/25 text-emerald-300"
                        : rec.matchLabel === "Matches your diet"
                        ? "bg-orange-600/25 text-orange-300"
                        : "bg-white/10 text-white/50"
                    )}
                  >
                    {rec.matchLabel}
                  </span>
                )}
                {translated && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-600/25 text-blue-300 font-medium">
                    🌐 {translated.langLabel}
                  </span>
                )}
              </div>
            </div>
            {rec.restaurantPhotoUrl && (
              <img
                src={rec.restaurantPhotoUrl}
                alt={rec.restaurantName}
                className="w-14 h-14 rounded-xl object-cover shrink-0 border border-white/10"
              />
            )}
          </div>
        </div>

        {/* ── Meal name + description ───────────────────────────────── */}
        <div className="px-4 pt-3">
          <div className="flex items-start gap-2">
            {meal.imageUrl ? (
              <img
                src={meal.imageUrl}
                alt={meal.name}
                className="w-16 h-16 rounded-xl object-cover shrink-0 border border-white/10"
              />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-orange-900/30 flex items-center justify-center shrink-0">
                <Utensils className="w-6 h-6 text-orange-400/50" />
              </div>
            )}
            <div className="min-w-0">
              <p className="font-semibold text-white leading-snug">{displayName}</p>
              {displayDescription && (
                <p className="text-xs text-white/55 mt-0.5 leading-relaxed">{displayDescription}</p>
              )}
              {meal.category && (
                <span className="inline-block text-[10px] text-white/35 mt-1">
                  {meal.category}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Macros ───────────────────────────────────────────────── */}
        <div className="mx-4 mt-3 rounded-xl bg-black/30 border border-white/8 px-4 py-3">
          <div className="grid grid-cols-4 gap-2 text-center">
            <MacroCell label="Cal"     value={meal.calories}           unit=""  status={nutritionStatus} />
            <MacroCell label="Protein" value={meal.proteinGrams}       unit="g" status={nutritionStatus} />
            <MacroCell label="Carbs"   value={meal.carbohydrateGrams}  unit="g" status={nutritionStatus} />
            <MacroCell label="Fat"     value={meal.fatGrams}           unit="g" status={nutritionStatus} />
          </div>
          {meal.caloriesRange && (
            <p className="text-center text-[10px] text-orange-400/70 mt-1.5">
              Range: {meal.caloriesRange.low}–{meal.caloriesRange.high} cal
            </p>
          )}
        </div>

        {/* ── Recommendation reason ─────────────────────────────────── */}
        {displayReason && (
          <div className="px-4 mt-3">
            <p className="text-xs text-white/65 leading-relaxed">{displayReason}</p>
          </div>
        )}

        {/* ── Protocol badges ───────────────────────────────────────── */}
        {protocol.badges && protocol.badges.length > 0 && (
          <div className="px-4 mt-3">
            <div className="flex flex-wrap gap-1.5">
              {protocol.badges.map((b, i) => (
                <BadgePill key={i} badge={b} />
              ))}
            </div>
          </div>
        )}

        {/* ── How to order ──────────────────────────────────────────── */}
        {hasHowToOrder && (
          <div className="px-4 mt-4">
            <div className="bg-orange-950/30 border border-orange-900/30 rounded-xl px-3 py-3">
              <div className="flex items-center gap-1.5 mb-2">
                <ShoppingBag className="w-3.5 h-3.5 text-orange-400" />
                <SectionLabel>How to order</SectionLabel>
              </div>
              {displayAskFor && (
                <p className="text-xs text-white font-medium mb-1">
                  Ask for: {displayAskFor}
                </p>
              )}
              {displayModify && displayModify.length > 0 && (
                <ul className="text-xs text-white/60 space-y-0.5 pl-1">
                  {displayModify.map((m, i) => (
                    <li key={i}>· {m}</li>
                  ))}
                </ul>
              )}
              {displaySwap && displaySwap.length > 0 && (
                <ul className="text-xs text-white/50 space-y-0.5 pl-1 mt-1">
                  {displaySwap.map((s, i) => (
                    <li key={i}>↔ {s}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* ── Medical waiter script ─────────────────────────────────── */}
        {displayWaiterScript && (
          <div className="px-4 mt-3">
            <div className="bg-white/5 border border-white/8 rounded-xl px-3 py-2.5">
              <SectionLabel>Say to your server</SectionLabel>
              <p className="text-xs text-white/75 leading-relaxed italic">
                "{displayWaiterScript}"
              </p>
            </div>
          </div>
        )}

        {/* ── Portion guidance ─────────────────────────────────────── */}
        {recommendation.portionGuidance && (
          <div className="px-4 mt-3">
            <p className="text-xs text-orange-300/70 leading-relaxed">
              {recommendation.portionGuidance}
            </p>
          </div>
        )}

        {/* ── Caution notes ─────────────────────────────────────────── */}
        {recommendation.cautionNotes && recommendation.cautionNotes.length > 0 && (
          <div className="px-4 mt-3">
            <div className="flex flex-col gap-1">
              {recommendation.cautionNotes.map((note, i) => (
                <p key={i} className="text-[11px] text-amber-400/80">⚠ {note}</p>
              ))}
            </div>
          </div>
        )}

        {/* ── Buffet plate breakdown ────────────────────────────────── */}
        {buffetItems && buffetItems.length > 0 && (
          <div className="px-4 mt-4">
            <SectionLabel>Your plate</SectionLabel>
            <div className="flex flex-col gap-1.5">
              {buffetItems.map((item, i) => {
                const translatedFood = translated?.buffetFoods?.[i];
                return (
                  <div key={i} className="flex items-start gap-2">
                    <ChefHat className="w-3 h-3 text-orange-400/60 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-xs text-white font-medium">
                        {translatedFood || item.food}
                      </span>
                      <span className="text-xs text-white/45"> · {item.portion}</span>
                      {item.note && (
                        <p className="text-[10px] text-white/35 leading-snug">{item.note}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Disclosure ────────────────────────────────────────────── */}
        <div className="px-4 mt-3">
          <DisclosureRow status={nutritionStatus} />
        </div>

        {/* ── Translate ────────────────────────────────────────────── */}
        <div className="px-4 mt-3">
          {translating ? (
            <div className="flex items-center gap-2 py-2">
              <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />
              <span className="text-xs text-blue-400">Translating…</span>
            </div>
          ) : translateOpen ? (
            <div className="space-y-2">
              <p className="text-[10px] text-white/40 uppercase tracking-wider">Translate to</p>
              <div className="flex flex-wrap gap-2">
                {TRANSLATE_LANGS.map(({ code, label }) => (
                  <button
                    key={code}
                    onClick={() => handleTranslate(code, label)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                      translated?.lang === code
                        ? "bg-blue-600 text-white"
                        : "bg-white/10 text-white/70"
                    )}
                  >
                    {label}
                  </button>
                ))}
                {translated && (
                  <button
                    onClick={() => { setTranslated(null); setTranslateOpen(false); }}
                    className="px-3 py-1.5 rounded-full text-xs font-medium bg-white/5 text-white/40 flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset
                  </button>
                )}
                <button
                  onClick={() => setTranslateOpen(false)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium bg-white/5 text-white/40"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setTranslateOpen(true)}
              className="flex items-center gap-1.5 text-[11px] text-white/40 bg-white/5 px-3 py-1.5 rounded-full"
            >
              <Languages className="w-3 h-3" />
              {translated ? `Translated: ${translated.langLabel}` : "Translate"}
            </button>
          )}
        </div>

        {/* ── Actions ───────────────────────────────────────────────── */}
        {!actionsDisabled && (
          <div className="px-4 mt-4 pb-4">
            {successMessage ? (
              <div className="w-full py-3 rounded-xl bg-emerald-900/40 border border-emerald-600/30 text-center">
                <span className="text-sm text-emerald-300 font-medium">{successMessage}</span>
              </div>
            ) : (
              <button
                onClick={() => setConfirmOpen(true)}
                className="w-full py-3 rounded-xl bg-orange-600 text-white font-semibold text-sm"
              >
                Log or Add to Plan
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Confirm sheet ──────────────────────────────────────────── */}
      <MacroConfirmSheet
        recommendation={rec}
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onSuccess={handleSuccess}
      />
    </>
  );
}
