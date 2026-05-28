import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { X, ShoppingBag, Bookmark, ChevronDown, ChevronUp } from "lucide-react";
import type { IngredientScanResult, ScoreVerdict } from "@/lib/photoIngredientCapture";

interface Props {
  open: boolean;
  result: IngredientScanResult | null;
  onClose: () => void;
  onAddAnyway: () => void;
  onSaveForReview: () => void;
  companionName?: string | null;
}

const GRADE_CONFIG = {
  A: { color: "text-emerald-400", bg: "bg-emerald-500/20 border-emerald-500/40", glow: "shadow-emerald-500/20" },
  B: { color: "text-lime-400", bg: "bg-lime-500/20 border-lime-500/40", glow: "shadow-lime-500/20" },
  C: { color: "text-amber-400", bg: "bg-amber-500/20 border-amber-500/40", glow: "shadow-amber-500/20" },
  D: { color: "text-rose-400", bg: "bg-rose-500/20 border-rose-500/40", glow: "shadow-rose-500/20" },
};

const VERDICT_CONFIG = {
  buy: { bg: "bg-emerald-500/15 border-emerald-500/30", color: "text-emerald-400", label: "Chef says: Go for it!" },
  caution: { bg: "bg-amber-500/15 border-amber-500/30", color: "text-amber-400", label: "Chef says: Just a heads up..." },
  skip: { bg: "bg-rose-500/15 border-rose-500/30", color: "text-rose-400", label: "Chef says: Maybe think twice" },
};

const FLAG_DOT = { ok: "bg-emerald-400", watch: "bg-amber-400", avoid: "bg-rose-400" };

function ScoreIcon({ verdict }: { verdict: ScoreVerdict }) {
  if (verdict === "thumbsUp") return <span className="text-2xl">👍</span>;
  if (verdict === "thumbsDown") return <span className="text-2xl">👎</span>;
  return <span className="text-2xl">🤔</span>;
}

const SCORE_BG: Record<ScoreVerdict, string> = {
  thumbsUp: "bg-emerald-500/15 border-emerald-500/25",
  thumbsDown: "bg-rose-500/15 border-rose-500/25",
  neutral: "bg-white/5 border-white/10",
};

const SCORE_CARDS_META = [
  { key: "kids" as const, label: "Kids", icon: "🧒" },
  { key: "adults" as const, label: "Adults", icon: "🧑" },
  { key: "diet" as const, label: "Your Diet", icon: "🥗" },
  { key: "fitnessGoal" as const, label: "Your Goal", icon: "🎯" },
];

export function ShoppingIngredientSheet({
  open, result, onClose, onAddAnyway, onSaveForReview, companionName,
}: Props) {
  const [decoderExpanded, setDecoderExpanded] = useState(false);
  const grade = result ? GRADE_CONFIG[result.alignmentGrade] ?? GRADE_CONFIG.B : null;
  const verdictCfg = result ? VERDICT_CONFIG[result.verdictLevel ?? "caution"] : null;
  const decoder = result?.ingredientDecoder ?? [];
  const scoreCards = result?.scoreCards;

  return (
    <AnimatePresence>
      {open && result && (
        <>
          <motion.div
            key="overlay"
            className="fixed inset-0 bg-black/70 z-40"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            key="sheet"
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-gradient-to-b from-gray-950 to-black border-t border-white/10 max-h-[88vh] overflow-y-auto"
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
          >
            <div className="px-4 pt-10 pb-8 max-w-lg mx-auto">
              <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-5" />

              {/* Header with chef mascot */}
              <div className="flex items-center gap-3 mb-4">
                <img
                  src="/icons/ChefMascotLogo.png"
                  alt="Chef"
                  className="w-24 h-24 rounded-full object-cover border-2 border-orange-500/40"
                />
                <div className="flex-1">
                  <p className="text-xs text-orange-400 font-bold uppercase tracking-wide">Smart Scan</p>
                  {companionName ? (
                    <>
                      <h2 className="text-white font-bold text-base leading-tight">Ingredient Analysis</h2>
                      <div className="mt-1 inline-flex items-center gap-1 bg-orange-600/20 border border-orange-500/30 rounded-full px-2 py-0.5">
                        <span className="text-[10px]">🐾</span>
                        <span className="text-orange-300 text-[10px] font-semibold">Scanning for {companionName}</span>
                      </div>
                    </>
                  ) : (
                    <h2 className="text-white font-bold text-base leading-tight">Ingredient Analysis</h2>
                  )}
                </div>
                <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Grade + Chef verdict side by side */}
              {grade && verdictCfg && (
                <div className={`rounded-2xl border p-4 mb-4 flex items-center gap-4 ${grade.bg} shadow-lg ${grade.glow}`}>
                  <div className={`text-6xl font-black leading-none ${grade.color}`}>{result.alignmentGrade}</div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-bold text-sm ${verdictCfg.color}`}>{verdictCfg.label}</p>
                    {result.verdict && (
                      <p className="text-xs text-white/70 leading-snug mt-1">{result.verdict}</p>
                    )}
                  </div>
                </div>
              )}

              {result.ocrConfidenceLow && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 mb-4">
                  <p className="text-sm text-amber-300">⚠️ Photo wasn't super clear — try retaking in better lighting for the full picture.</p>
                </div>
              )}

              {/* 2×2 Score Cards */}
              {scoreCards && (
                <div className="mb-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-white/40 mb-2">How it scores for you</p>
                  <div className="grid grid-cols-2 gap-2">
                    {SCORE_CARDS_META.map(({ key, label, icon }) => {
                      const card = scoreCards[key];
                      return (
                        <div key={key} className={`rounded-xl border p-3 ${SCORE_BG[card.verdict]}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-white/60">{icon} {label}</span>
                            <ScoreIcon verdict={card.verdict} />
                          </div>
                          {card.reason && (
                            <p className="text-[11px] text-white/55 leading-snug">{card.reason}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Ingredient Decoder */}
              {decoder.length > 0 && (
                <div className="mb-4">
                  <button
                    onClick={() => setDecoderExpanded((v) => !v)}
                    className="w-full flex items-center justify-between mb-2"
                  >
                    <p className="text-xs font-bold uppercase tracking-wide text-white/40">
                      🔬 What's in this? (plain English)
                    </p>
                    {decoderExpanded
                      ? <ChevronUp className="w-3.5 h-3.5 text-white/30" />
                      : <ChevronDown className="w-3.5 h-3.5 text-white/30" />}
                  </button>
                  {!decoderExpanded && (
                    <p className="text-xs text-orange-400/70 font-medium">
                      Tap to decode {decoder.length} ingredient{decoder.length !== 1 ? "s" : ""} in plain English
                    </p>
                  )}
                  <AnimatePresence>
                    {decoderExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="space-y-2">
                          {decoder.map((item, i) => (
                            <div key={i} className="rounded-lg bg-white/5 border border-white/8 px-3 py-2.5 flex items-start gap-2.5">
                              <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${FLAG_DOT[item.flag]}`} />
                              <div>
                                <p className="text-xs font-semibold text-white/85">{item.name}</p>
                                <p className="text-xs text-white/55 leading-snug mt-0.5">{item.plain}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        <p className="text-[10px] text-white/25 mt-2 pl-1">
                          🟢 Generally safe · 🟡 Worth knowing · 🔴 Conflicts with your profile
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Household notes */}
              {result.householdNotes.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-white/40 mb-2">🏠 Family Notes</p>
                  <ul className="space-y-1">
                    {result.householdNotes.map((note, i) => (
                      <li key={i} className="text-xs text-white/70 flex items-start gap-2">
                        <span className="text-white/25 mt-0.5">•</span><span>{note}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-2 mt-2">
                <button
                  onClick={onAddAnyway}
                  className="w-full flex items-center justify-center gap-2 bg-orange-600 rounded-2xl py-3.5 text-white font-semibold text-sm active:scale-[.98] transition-transform"
                >
                  <ShoppingBag className="w-4 h-4" />
                  Add to List — Name It Below
                </button>
                <p className="text-xs text-white/30 text-center -mt-1">You'll type the product name in the form below.</p>
                <button
                  onClick={onSaveForReview}
                  className="w-full flex items-center justify-center gap-1.5 bg-white/8 border border-white/10 rounded-xl py-3 text-white/70 text-sm"
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  Save Scan
                </button>
              </div>

              <p className="text-[10px] text-white/15 text-center mt-4 leading-relaxed px-2">
                Personalized wellness education — not medical advice. Chef is coaching, not diagnosing.
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default ShoppingIngredientSheet;
