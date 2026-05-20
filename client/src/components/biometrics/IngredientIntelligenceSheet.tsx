import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { X, ChevronDown, ChevronUp } from 'lucide-react';
import type { IngredientScanResult, ScoreVerdict } from '@/lib/photoIngredientCapture';

interface Props {
  open: boolean;
  result: IngredientScanResult | null;
  onClose: () => void;
}

const GRADE_CONFIG = {
  A: { color: 'text-emerald-400', bg: 'bg-emerald-500/20 border-emerald-500/40', desc: 'Excellent Alignment', glow: 'shadow-emerald-500/20' },
  B: { color: 'text-lime-400', bg: 'bg-lime-500/20 border-lime-500/40', desc: 'Good Alignment', glow: 'shadow-lime-500/20' },
  C: { color: 'text-amber-400', bg: 'bg-amber-500/20 border-amber-500/40', desc: 'Some Considerations', glow: 'shadow-amber-500/20' },
  D: { color: 'text-rose-400', bg: 'bg-rose-500/20 border-rose-500/40', desc: 'Notable Conflicts', glow: 'shadow-rose-500/20' },
};

const VERDICT_CONFIG = {
  buy: { bg: 'bg-emerald-500/15 border-emerald-500/30', color: 'text-emerald-400', label: 'Chef says: Go for it!' },
  caution: { bg: 'bg-amber-500/15 border-amber-500/30', color: 'text-amber-400', label: 'Chef says: Just a heads up...' },
  skip: { bg: 'bg-rose-500/15 border-rose-500/30', color: 'text-rose-400', label: 'Chef says: Maybe think twice' },
};

const SCORE_BG: Record<ScoreVerdict, string> = {
  thumbsUp: 'bg-emerald-500/15 border-emerald-500/25',
  thumbsDown: 'bg-rose-500/15 border-rose-500/25',
  neutral: 'bg-white/5 border-white/10',
};

const FLAG_DOT = { ok: 'bg-emerald-400', watch: 'bg-amber-400', avoid: 'bg-rose-400' };

const SCORE_CARDS_META = [
  { key: 'kids' as const, label: 'Kids', icon: '🧒' },
  { key: 'adults' as const, label: 'Adults', icon: '🧑' },
  { key: 'diet' as const, label: 'Your Diet', icon: '🥗' },
  { key: 'fitnessGoal' as const, label: 'Your Goal', icon: '🎯' },
];

function ScoreIcon({ verdict }: { verdict: ScoreVerdict }) {
  if (verdict === 'thumbsUp') return <span className="text-2xl">👍</span>;
  if (verdict === 'thumbsDown') return <span className="text-2xl">👎</span>;
  return <span className="text-2xl">🤔</span>;
}

function Section({ title, items, icon }: { title: string; items: string[]; icon: string }) {
  if (!items.length) return null;
  return (
    <div className="mb-4">
      <p className="text-xs font-bold uppercase tracking-wide text-white/40 mb-2">{icon} {title}</p>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-white/75 flex items-start gap-2">
            <span className="text-white/25 mt-0.5">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function IngredientDecoder({ items }: { items: IngredientScanResult['ingredientDecoder'] }) {
  const [open, setOpen] = useState(true);
  if (!items || items.length === 0) return null;
  return (
    <div className="mb-4">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between mb-2">
        <p className="text-xs font-bold uppercase tracking-wide text-white/40">🔬 Plain English Decoder</p>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-white/25" /> : <ChevronDown className="w-3.5 h-3.5 text-white/25" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="rounded-lg bg-white/5 border border-white/8 px-3 py-2.5 flex items-start gap-2.5">
                  <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${FLAG_DOT[item.flag]}`} />
                  <div className="flex-1 min-w-0">
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
  );
}

export function IngredientIntelligenceSheet({ open, result, onClose }: Props) {
  const grade = result ? GRADE_CONFIG[result.alignmentGrade] ?? GRADE_CONFIG.B : null;
  const verdictCfg = result ? VERDICT_CONFIG[result.verdictLevel ?? 'caution'] : null;
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
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-gradient-to-b from-gray-950 to-black border-t border-white/10 max-h-[90vh] overflow-y-auto"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          >
            <div className="px-4 pt-4 pb-8 max-w-lg mx-auto">
              <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-3" />

              {/* Header with chef mascot */}
              <div className="flex items-center gap-3 mb-4">
                <img
                  src="/icons/ChefMascotLogo.png"
                  alt="Chef"
                  className="w-12 h-12 rounded-full object-cover border-2 border-orange-500/40"
                />
                <div className="flex-1">
                  <p className="text-xs text-orange-400 font-bold uppercase tracking-wide">Ingredient Intelligence</p>
                  <h2 className="text-white font-bold text-base leading-tight">Full Analysis</h2>
                </div>
                <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Grade banner */}
              {grade && (
                <div className={`rounded-2xl border p-4 mb-3 flex items-center gap-4 ${grade.bg} shadow-lg ${grade.glow}`}>
                  <div className={`text-6xl font-black leading-none ${grade.color}`}>{result.alignmentGrade}</div>
                  <div>
                    <p className={`font-bold text-base ${grade.color}`}>{grade.desc}</p>
                    <p className="text-xs text-white/45 mt-0.5">Personalized to your health profile</p>
                  </div>
                </div>
              )}

              {/* Chef verdict */}
              {verdictCfg && result.verdict && (
                <div className={`rounded-xl border p-3.5 mb-4 flex items-start gap-3 ${verdictCfg.bg}`}>
                  <img src="/icons/ChefMascotLogo.png" alt="" className="w-7 h-7 rounded-full shrink-0 mt-0.5 border border-orange-500/30" />
                  <div>
                    <p className={`text-xs font-bold uppercase tracking-wide mb-0.5 ${verdictCfg.color}`}>{verdictCfg.label}</p>
                    <p className="text-sm text-white/85 leading-snug">{result.verdict}</p>
                  </div>
                </div>
              )}

              {result.ocrConfidenceLow && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 mb-4">
                  <p className="text-sm text-amber-300">⚠️ Photo wasn't fully clear — try retaking in better lighting for the most complete reading.</p>
                </div>
              )}

              {/* Overall coach summary */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 mb-4">
                <p className="text-sm text-white/85 leading-relaxed">{result.overallSummary}</p>
              </div>

              {/* 2×2 Score Cards */}
              {scoreCards && (
                <div className="mb-5">
                  <p className="text-xs font-bold uppercase tracking-wide text-white/40 mb-2">How it scores for you</p>
                  <div className="grid grid-cols-2 gap-2">
                    {SCORE_CARDS_META.map(({ key, label, icon }) => {
                      const card = scoreCards[key];
                      return (
                        <div key={key} className={`rounded-xl border p-3 ${SCORE_BG[card.verdict]}`}>
                          <div className="flex items-center justify-between mb-1.5">
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

              {/* Plain English Decoder */}
              <IngredientDecoder items={result.ingredientDecoder ?? []} />

              {/* Ingredient sections */}
              <Section title="Ingredient Considerations" items={result.ingredientConsiderations} icon="🔍" />
              <Section title="May Not Align With Your Goals" items={result.mayNotAlignWith} icon="⚠️" />
              <Section title="Works Well For" items={result.betterFor} icon="✓" />
              <Section title="Family Notes" items={result.householdNotes} icon="🏠" />

              {/* Detected ingredients (collapsed) */}
              {result.extractedIngredients.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-white/40 mb-2">📋 Detected Ingredients</p>
                  <div className="rounded-xl border border-white/10 bg-black/30 p-3 max-h-24 overflow-y-auto">
                    <p className="text-xs text-white/40 leading-relaxed">
                      {result.extractedIngredients.join(', ')}
                    </p>
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-2 justify-center">
                <img src="/icons/ChefMascotLogo.png" alt="" className="w-5 h-5 rounded-full opacity-50" />
                <p className="text-[10px] text-white/30 leading-relaxed text-center">
                  {result.educationalFooter}
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default IngredientIntelligenceSheet;
