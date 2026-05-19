import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { X, ChevronDown, ChevronUp } from 'lucide-react';
import type { IngredientScanResult } from '@/lib/photoIngredientCapture';

interface Props {
  open: boolean;
  result: IngredientScanResult | null;
  onClose: () => void;
}

const GRADE_CONFIG = {
  A: { label: 'A', color: 'text-emerald-400', bg: 'bg-emerald-500/20 border-emerald-500/40', desc: 'Excellent Alignment' },
  B: { label: 'B', color: 'text-lime-400', bg: 'bg-lime-500/20 border-lime-500/40', desc: 'Good Alignment' },
  C: { label: 'C', color: 'text-amber-400', bg: 'bg-amber-500/20 border-amber-500/40', desc: 'Fair — Some Considerations' },
  D: { label: 'D', color: 'text-rose-400', bg: 'bg-rose-500/20 border-rose-500/40', desc: 'Notable Conflicts' },
};

const VERDICT_CONFIG = {
  buy: { bg: 'bg-emerald-500/15 border-emerald-500/30', icon: '✓', color: 'text-emerald-400', label: 'Good to Buy' },
  caution: { bg: 'bg-amber-500/15 border-amber-500/30', icon: '!', color: 'text-amber-400', label: 'Buy With Caution' },
  skip: { bg: 'bg-rose-500/15 border-rose-500/30', icon: '✕', color: 'text-rose-400', label: 'Consider Skipping' },
};

const FLAG_CONFIG = {
  ok: { dot: 'bg-emerald-400', label: 'Safe' },
  watch: { dot: 'bg-amber-400', label: 'Worth knowing' },
  avoid: { dot: 'bg-rose-400', label: 'Conflicts with your profile' },
};

const LEARN_WHY: Record<string, string> = {
  considerations: "These are specific ingredients found in this product that may warrant attention based on your health profile. We flag them so you can make an informed choice — not to tell you what to eat.",
  notAlign: "This section is personalized to you. The same product can produce completely different guidance for different users depending on their unique goals, health conditions, and dietary protocols. Someone else scanning this exact product may see a very different result.",
  household: "If you're shopping for a family or household, some ingredients may affect other members differently — especially children, people with sensitivities, or those with different dietary needs than you.",
};

function Section({
  title,
  items,
  icon,
  learnWhyKey,
}: {
  title: string;
  items: string[];
  icon: string;
  learnWhyKey?: keyof typeof LEARN_WHY;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!items.length) return null;
  const explanation = learnWhyKey ? LEARN_WHY[learnWhyKey] : undefined;
  return (
    <div className="mb-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-white/50 mb-2">
        {icon} {title}
      </p>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-white/80 flex items-start gap-2">
            <span className="text-white/30 mt-0.5">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
      {explanation && (
        <div className="mt-2">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-xs text-orange-400/80 font-medium"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            Learn Why
          </button>
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <p className="text-xs text-white/50 leading-relaxed mt-2 pl-1 border-l border-orange-500/30">
                  {explanation}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function IngredientDecoder({ items }: { items: IngredientScanResult['ingredientDecoder'] }) {
  const [expanded, setExpanded] = useState(true);
  if (!items || items.length === 0) return null;
  return (
    <div className="mb-4">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between mb-2"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-white/50">
          🔬 What's In This? Plain English Decoder
        </p>
        {expanded
          ? <ChevronUp className="w-3.5 h-3.5 text-white/30" />
          : <ChevronDown className="w-3.5 h-3.5 text-white/30" />
        }
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-2">
              {items.map((item, i) => (
                <div
                  key={i}
                  className="rounded-lg bg-white/5 border border-white/8 px-3 py-2.5 flex items-start gap-2.5"
                >
                  <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${FLAG_CONFIG[item.flag].dot}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white/85">{item.name}</p>
                    <p className="text-xs text-white/55 leading-snug mt-0.5">{item.plain}</p>
                  </div>
                  <span className="text-[10px] text-white/25 shrink-0 mt-0.5">{FLAG_CONFIG[item.flag].label}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-white/25 mt-2 pl-1">
              Green = generally recognized safe · Yellow = worth being aware of · Red = may conflict with your profile
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
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-gradient-to-b from-black/95 to-gray-950 border-t border-white/10 max-h-[90vh] overflow-y-auto"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          >
            <div className="px-4 pt-4 pb-8 max-w-lg mx-auto">
              {/* Drag handle */}
              <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-4" />

              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs text-orange-400 font-semibold uppercase tracking-wide">
                    Ingredient Intelligence
                  </p>
                  <h2 className="text-white font-bold text-lg leading-tight">
                    Full Analysis
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Alignment Grade */}
              {grade && (
                <div className={`rounded-xl border p-4 mb-3 flex items-center gap-4 ${grade.bg}`}>
                  <div className={`text-5xl font-black ${grade.color}`}>{grade.label}</div>
                  <div>
                    <p className={`font-bold text-base ${grade.color}`}>{grade.desc}</p>
                    <p className="text-xs text-white/50 mt-0.5">Based on your health profile</p>
                  </div>
                </div>
              )}

              {/* Verdict — the "should I buy it" answer */}
              {verdictCfg && result.verdict && (
                <div className={`rounded-xl border p-3.5 mb-4 flex items-start gap-3 ${verdictCfg.bg}`}>
                  <span className={`text-lg font-black leading-none mt-0.5 ${verdictCfg.color}`}>
                    {verdictCfg.icon}
                  </span>
                  <div>
                    <p className={`text-xs font-bold uppercase tracking-wide mb-0.5 ${verdictCfg.color}`}>
                      {verdictCfg.label}
                    </p>
                    <p className="text-sm text-white/85 leading-snug">{result.verdict}</p>
                  </div>
                </div>
              )}

              {/* Low confidence warning */}
              {result.ocrConfidenceLow && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 mb-4">
                  <p className="text-sm text-amber-300">
                    ⚠️ Some ingredients may not have been fully legible. Try retaking the photo in better lighting for a more complete analysis.
                  </p>
                </div>
              )}

              {/* Overall Summary */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 mb-4">
                <p className="text-sm text-white/90 leading-relaxed">{result.overallSummary}</p>
              </div>

              {/* Plain English Ingredient Decoder — first-class feature */}
              <IngredientDecoder items={result.ingredientDecoder ?? []} />

              {/* Household & Kids */}
              <Section
                title="Family & Kids"
                items={result.householdNotes}
                icon="🏠"
                learnWhyKey="household"
              />

              {/* Ingredient Considerations */}
              <Section
                title="Ingredient Considerations"
                items={result.ingredientConsiderations}
                icon="🔍"
                learnWhyKey="considerations"
              />

              {/* May Not Align With */}
              <Section
                title="May Not Align Well With Your Goals"
                items={result.mayNotAlignWith}
                icon="⚠️"
                learnWhyKey="notAlign"
              />

              {/* Better For */}
              <Section
                title="Works Well For"
                items={result.betterFor}
                icon="✓"
              />

              {/* Extracted Ingredients (collapsible preview) */}
              {result.extractedIngredients.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-white/50 mb-2">
                    📋 Detected Ingredients
                  </p>
                  <div className="rounded-xl border border-white/10 bg-black/30 p-3 max-h-28 overflow-y-auto">
                    <p className="text-xs text-white/50 leading-relaxed">
                      {result.extractedIngredients.join(', ')}
                    </p>
                  </div>
                </div>
              )}

              {/* Educational Footer */}
              <div className="mt-4 pt-4 border-t border-white/10">
                <p className="text-xs text-white/35 leading-relaxed text-center">
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
