import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { X, ShoppingBag, Bookmark, BookOpen, ChevronDown, ChevronUp, Tag } from "lucide-react";
import type { IngredientScanResult } from "@/lib/photoIngredientCapture";

interface Props {
  open: boolean;
  result: IngredientScanResult | null;
  onClose: () => void;
  onAddAnyway: (name: string) => void;
  onSaveForReview: (name: string) => void;
  onLearnWhy: () => void;
}

const GRADE_CONFIG = {
  A: { label: "A", color: "text-emerald-400", bg: "bg-emerald-500/20 border-emerald-500/40", desc: "Excellent Alignment" },
  B: { label: "B", color: "text-lime-400", bg: "bg-lime-500/20 border-lime-500/40", desc: "Good Alignment" },
  C: { label: "C", color: "text-amber-400", bg: "bg-amber-500/20 border-amber-500/40", desc: "Fair — Some Considerations" },
  D: { label: "D", color: "text-rose-400", bg: "bg-rose-500/20 border-rose-500/40", desc: "Notable Conflicts" },
};

const LEARN_WHY_CONSIDERATIONS =
  "These are specific ingredients found in this product that may warrant attention based on your health profile. We flag them so you can make an informed choice — not to tell you what to eat.";

export function ShoppingIngredientSheet({
  open,
  result,
  onClose,
  onAddAnyway,
  onSaveForReview,
  onLearnWhy,
}: Props) {
  const [considerationsExpanded, setConsiderationsExpanded] = useState(false);
  const [editableName, setEditableName] = useState("");
  const [listening, setListening] = useState(false);
  const grade = result ? GRADE_CONFIG[result.alignmentGrade] ?? GRADE_CONFIG.B : null;
  const topConsiderations = result?.ingredientConsiderations.slice(0, 3) ?? [];

  // Reset name field each time a new scan opens
  useEffect(() => {
    if (open) setEditableName("");
  }, [open]);

  function startVoice() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    setListening(true);
    rec.onresult = (e: any) => {
      const transcript: string = e.results[0][0].transcript;
      setEditableName(transcript.trim());
      setListening(false);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
  }

  const resolvedName = editableName.trim() || "Scanned Item";

  return (
    <AnimatePresence>
      {open && result && (
        <>
          <motion.div
            key="overlay"
            className="fixed inset-0 bg-black/60 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            key="sheet"
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-gradient-to-b from-black/95 to-gray-950 border-t border-white/10 max-h-[85vh] overflow-y-auto"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
          >
            <div className="px-4 pt-4 pb-8 max-w-lg mx-auto">
              {/* Drag handle */}
              <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-4" />

              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs text-orange-400 font-semibold uppercase tracking-wide">
                    Smart Scan
                  </p>
                  <h2 className="text-white font-bold text-lg leading-tight">
                    Ingredient Analysis
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Grade */}
              {grade && (
                <div className={`rounded-xl border p-4 mb-4 flex items-center gap-4 ${grade.bg}`}>
                  <div className={`text-5xl font-black ${grade.color}`}>{grade.label}</div>
                  <div>
                    <p className={`font-bold text-base ${grade.color}`}>{grade.desc}</p>
                    <p className="text-xs text-white/50 mt-0.5">Based on your health profile</p>
                  </div>
                </div>
              )}

              {/* Low confidence warning */}
              {result.ocrConfidenceLow && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 mb-4">
                  <p className="text-sm text-amber-300">
                    ⚠️ Some ingredients may not have been fully legible. Try retaking in better lighting.
                  </p>
                </div>
              )}

              {/* Quick summary */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 mb-4">
                <p className="text-sm text-white/90 leading-relaxed">{result.overallSummary}</p>
              </div>

              {/* Considerations — capped at 3 */}
              {topConsiderations.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-white/50 mb-2">
                    🔍 Ingredient Considerations
                  </p>
                  <ul className="space-y-1">
                    {topConsiderations.map((item, i) => (
                      <li key={i} className="text-sm text-white/80 flex items-start gap-2">
                        <span className="text-white/30 mt-0.5">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2">
                    <button
                      onClick={() => setConsiderationsExpanded((v) => !v)}
                      className="flex items-center gap-1 text-xs text-orange-400/80 font-medium"
                    >
                      {considerationsExpanded ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                      Learn Why
                    </button>
                    <AnimatePresence>
                      {considerationsExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <p className="text-xs text-white/50 leading-relaxed mt-2 pl-1 border-l border-orange-500/30">
                            {LEARN_WHY_CONSIDERATIONS}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {/* Household Notes */}
              {result.householdNotes.length > 0 && (
                <div className="mb-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-white/50 mb-2">
                    🏠 Household Notes
                  </p>
                  <ul className="space-y-1">
                    {result.householdNotes.map((note, i) => (
                      <li key={i} className="text-sm text-white/80 flex items-start gap-2">
                        <span className="text-white/30 mt-0.5">•</span>
                        <span>{note}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* ── Name this item ───────────────────────────────────────── */}
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 mb-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40 mb-2 flex items-center gap-1.5">
                  <Tag className="w-3 h-3" />
                  Name this item
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editableName}
                    onChange={(e) => setEditableName(e.target.value)}
                    placeholder="e.g. Rao's Marinara, Fairlife Shake…"
                    className="flex-1 bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-orange-500/50 caret-white"
                  />
                  <button
                    onClick={startVoice}
                    disabled={listening}
                    className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                      listening
                        ? "bg-orange-500/30 border border-orange-400/50 animate-pulse"
                        : "bg-white/8 border border-white/15 active:opacity-70"
                    }`}
                    aria-label="Voice input"
                  >
                    <span className="text-base">{listening ? "🎙️" : "🎤"}</span>
                  </button>
                </div>
                <p className="text-[10px] text-white/25 mt-1.5 leading-relaxed">
                  Optional — tap the mic or type. Helps you find it later in your scan history.
                </p>
              </div>

              {/* Action buttons */}
              <div className="space-y-2 mt-2">
                <button
                  onClick={() => onAddAnyway(resolvedName)}
                  className="w-full flex items-center justify-center gap-2 bg-orange-600 rounded-2xl py-3.5 text-white font-semibold text-sm"
                >
                  <ShoppingBag className="w-4 h-4" />
                  Add to Shopping List
                </button>
                <p className="text-xs text-white/35 text-center -mt-1">
                  Balance matters more than perfection.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => onSaveForReview(resolvedName)}
                    className="flex items-center justify-center gap-1.5 bg-white/8 border border-white/10 rounded-xl py-3 text-white/70 text-sm"
                  >
                    <Bookmark className="w-3.5 h-3.5" />
                    Save for Review
                  </button>
                  <button
                    onClick={onLearnWhy}
                    className="flex items-center justify-center gap-1.5 bg-white/8 border border-white/10 rounded-xl py-3 text-white/70 text-sm"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    Learn Why
                  </button>
                </div>
              </div>

              {/* Better Choice coming soon microcopy */}
              <p className="text-xs text-white/25 text-center mt-4 leading-relaxed">
                Future updates will include healthier product alternatives.
              </p>

              {/* Educational footer */}
              <p className="text-[10px] text-white/20 text-center mt-2 leading-relaxed px-2">
                Analysis is educational and personalized to your profile. Not a medical recommendation.
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default ShoppingIngredientSheet;
