import { useState } from "react";
import { X, ChevronDown, ChevronUp, ShoppingBag, BookOpen, Bookmark } from "lucide-react";

const GRADE = {
  label: "B",
  color: "text-lime-400",
  bg: "bg-lime-500/15 border-lime-500/40",
  desc: "Good Alignment",
};

const considerations = [
  "Contains added cane sugar (9g per serving)",
  "Carrageenan — a common thickener, may cause digestive sensitivity in some",
  "Soy lecithin — generally well-tolerated, but present for soy-sensitive users",
];

const learnWhyText = "These are specific ingredients found in this product that may warrant attention based on your health profile. We flag them so you can make an informed choice — not to tell you what to eat.";

const householdNotes = [
  "Contains artificial dyes (Red 40) — may be worth noting for young children",
];

export function ResultSheet() {
  const [learnOpen, setLearnOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-orange-950/60 to-black flex items-center justify-center">
        <p className="text-white/30 text-sm">Sheet dismissed</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-black via-orange-950/60 to-black font-sans overflow-hidden select-none">

      {/* Blurred background page */}
      <div className="absolute inset-0 opacity-30 px-4 pt-14 space-y-3">
        <div className="h-12 bg-white/5 rounded-xl" />
        <div className="h-8 bg-white/5 rounded-xl" />
        <div className="h-8 bg-white/5 rounded-xl" />
        <div className="h-32 bg-white/5 rounded-xl" />
        <div className="h-32 bg-white/5 rounded-xl" />
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Sheet */}
      <div className="absolute bottom-0 left-0 right-0 rounded-t-3xl bg-gradient-to-b from-gray-950 to-black border-t border-white/10 max-h-[88%] overflow-y-auto">
        <div className="px-4 pt-3 pb-8">

          {/* Drag handle */}
          <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-4" />

          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-orange-400">
                Ingredient Intelligence
              </p>
              <h2 className="text-white font-bold text-lg leading-tight">
                Product Analysis
              </h2>
            </div>
            <button
              onClick={() => setDismissed(true)}
              className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Alignment Grade */}
          <div className={`rounded-2xl border p-4 mb-4 flex items-center gap-4 ${GRADE.bg}`}>
            <div className={`text-5xl font-black ${GRADE.color}`}>{GRADE.label}</div>
            <div>
              <p className={`font-bold text-base ${GRADE.color}`}>{GRADE.desc}</p>
              <p className="text-xs text-white/40 mt-0.5">Based on your health profile</p>
            </div>
          </div>

          {/* Quick summary */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 mb-4">
            <p className="text-sm text-white/80 leading-relaxed">
              This product aligns reasonably well with your goals. A few ingredients are worth noting — added sugars and a thickening agent may be minor considerations for your anti-inflammatory protocol, but nothing that conflicts significantly.
            </p>
          </div>

          {/* Considerations */}
          <div className="mb-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40 mb-2">🔍 Ingredient Considerations</p>
            <ul className="space-y-1.5 mb-2">
              {considerations.map((c, i) => (
                <li key={i} className="text-sm text-white/75 flex items-start gap-2">
                  <span className="text-white/25 mt-0.5 flex-shrink-0">•</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={() => setLearnOpen(v => !v)}
              className="flex items-center gap-1 text-xs text-orange-400/80 font-medium mt-1"
            >
              {learnOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              Learn Why
            </button>
            {learnOpen && (
              <p className="text-xs text-white/45 leading-relaxed mt-2 pl-2 border-l border-orange-500/30">
                {learnWhyText}
              </p>
            )}
          </div>

          {/* Household Notes */}
          {householdNotes.length > 0 && (
            <div className="mb-5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40 mb-2">🏠 Household Notes</p>
              <ul className="space-y-1.5">
                {householdNotes.map((n, i) => (
                  <li key={i} className="text-sm text-white/75 flex items-start gap-2">
                    <span className="text-white/25 mt-0.5 flex-shrink-0">•</span>
                    <span>{n}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action buttons */}
          <div className="space-y-2 mt-2">
            <button className="w-full flex items-center justify-center gap-2 bg-orange-600 rounded-2xl py-3.5 text-white font-semibold text-sm">
              <ShoppingBag className="w-4 h-4" />
              Add to Cart Anyway
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button className="flex items-center justify-center gap-1.5 bg-white/8 border border-white/10 rounded-xl py-3 text-white/70 text-sm">
                <Bookmark className="w-3.5 h-3.5" />
                Save for Review
              </button>
              <button className="flex items-center justify-center gap-1.5 bg-white/8 border border-white/10 rounded-xl py-3 text-white/70 text-sm">
                <BookOpen className="w-3.5 h-3.5" />
                Learn Why
              </button>
            </div>
          </div>

          {/* Footer */}
          <p className="text-[10px] text-white/25 text-center mt-4 leading-relaxed px-2">
            Analysis is educational and personalized to your profile. Not a medical recommendation.
          </p>

        </div>
      </div>
    </div>
  );
}
