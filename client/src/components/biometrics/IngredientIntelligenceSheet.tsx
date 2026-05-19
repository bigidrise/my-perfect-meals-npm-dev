import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
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

function Section({ title, items, icon }: { title: string; items: string[]; icon: string }) {
  if (!items.length) return null;
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
    </div>
  );
}

export function IngredientIntelligenceSheet({ open, result, onClose }: Props) {
  const grade = result ? GRADE_CONFIG[result.alignmentGrade] ?? GRADE_CONFIG.B : null;

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
                    Product Analysis
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
                    ⚠️ Some ingredients may not have been fully legible. Try retaking the photo in better lighting for a more complete analysis.
                  </p>
                </div>
              )}

              {/* Overall Summary */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 mb-4">
                <p className="text-sm text-white/90 leading-relaxed">{result.overallSummary}</p>
              </div>

              {/* Ingredient Considerations */}
              <Section
                title="Ingredient Considerations"
                items={result.ingredientConsiderations}
                icon="🔍"
              />

              {/* May Not Align With */}
              <Section
                title="May Not Align Well With"
                items={result.mayNotAlignWith}
                icon="⚠️"
              />

              {/* Better For */}
              <Section
                title="Better For"
                items={result.betterFor}
                icon="✓"
              />

              {/* Household Notes */}
              <Section
                title="Household Notes"
                items={result.householdNotes}
                icon="🏠"
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
