import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { X, ChevronDown, ChevronUp } from 'lucide-react';
import type { IngredientScanResult, ScoreVerdict, OutcomeVerdict } from '@/lib/photoIngredientCapture';

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

const OUTCOME_CONFIG: Record<OutcomeVerdict, { bg: string; border: string; badgeBg: string; badgeText: string; label: string }> = {
  supports:  { bg: 'bg-emerald-500/10', border: 'border-emerald-500/25', badgeBg: 'bg-emerald-500/20', badgeText: 'text-emerald-300', label: '✓' },
  caution:   { bg: 'bg-amber-500/10',   border: 'border-amber-500/25',   badgeBg: 'bg-amber-500/20',   badgeText: 'text-amber-300',   label: '⚠' },
  conflicts: { bg: 'bg-rose-500/10',    border: 'border-rose-500/25',    badgeBg: 'bg-rose-500/20',    badgeText: 'text-rose-300',    label: '✕' },
  neutral:   { bg: 'bg-white/5',        border: 'border-white/10',       badgeBg: 'bg-white/10',       badgeText: 'text-white/40',    label: '—' },
};

const PROTOCOL_ICONS: Record<string, string> = {
  'blood-glucose':      '🩸',
  'fiber':              '🌾',
  'protein':            '💪',
  'satiety':            '⚖️',
  'digestive':          '🫁',
  'sodium':             '🧂',
  'heart':              '❤️',
  'kidney':             '🫘',
  'inflammation':       '🔥',
  'ingredient-quality': '✨',
  'thyroid':            '🦋',
  'iodine':             '⚗️',
  'hormone':            '⚡',
  'immune':             '🛡️',
  'overall-nutrition':  '🥗',
  'diet-compat':        '🥗',
  'goal-alignment':     '🎯',
  'caloric-balance':    '⚖️',
  'caloric-support':    '🔋',
  'recovery':           '🔄',
};

const LEGACY_SCORE_BG: Record<ScoreVerdict, string> = {
  thumbsUp: 'bg-emerald-500/15 border-emerald-500/25',
  thumbsDown: 'bg-rose-500/15 border-rose-500/25',
  neutral: 'bg-white/5 border-white/10',
};

const FLAG_DOT = { ok: 'bg-emerald-400', watch: 'bg-amber-400', avoid: 'bg-rose-400' };

function LegacyScoreIcon({ verdict }: { verdict: ScoreVerdict }) {
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

function ProtocolImpactSummary({ cards }: { cards: IngredientScanResult['outcomeCards'] }) {
  if (!cards || cards.length === 0) return null;
  const alignsWith = cards.filter(c => c.verdict === 'supports');
  const watchFor   = cards.filter(c => c.verdict === 'conflicts' || c.verdict === 'caution');
  if (alignsWith.length === 0 && watchFor.length === 0) return null;

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 mb-4 space-y-3">
      {alignsWith.length > 0 && (
        <div>
          <p className="text-xs font-bold text-emerald-400/80 uppercase tracking-wide mb-2">Aligns with your goals</p>
          <ul className="space-y-1">
            {alignsWith.map(c => (
              <li key={c.protocolKey} className="flex items-center gap-2 text-sm text-white/75">
                <span className="text-emerald-400 text-xs font-bold shrink-0">✓</span>
                <span>{c.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {watchFor.length > 0 && (
        <div>
          <p className="text-xs font-bold text-amber-400/80 uppercase tracking-wide mb-2">Watch for</p>
          <ul className="space-y-2">
            {watchFor.map(c => (
              <li key={c.protocolKey} className="flex items-start gap-2 text-sm">
                <span className={`text-xs font-bold shrink-0 mt-0.5 ${c.verdict === 'conflicts' ? 'text-rose-400' : 'text-amber-400'}`}>
                  {c.verdict === 'conflicts' ? '✕' : '⚠'}
                </span>
                <span>
                  <span className="text-white/80">{c.label}</span>
                  {c.reason && <span className="text-white/45"> — {c.reason}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function OutcomeCardsGrid({ cards }: { cards: IngredientScanResult['outcomeCards'] }) {
  if (!cards || cards.length === 0) return null;
  return (
    <div className="mb-5">
      <p className="text-xs font-bold uppercase tracking-wide text-white/40 mb-2">How it scores for your protocols</p>
      <div className="grid grid-cols-2 gap-2">
        {cards.map((card) => {
          const cfg = OUTCOME_CONFIG[card.verdict];
          const icon = PROTOCOL_ICONS[card.protocolKey] ?? '📊';
          return (
            <div key={card.protocolKey} className={`rounded-xl border p-3 ${cfg.bg} ${cfg.border}`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-white/65 leading-tight">{icon} {card.label}</span>
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full shrink-0 ml-1 ${cfg.badgeBg} ${cfg.badgeText}`}>
                  {cfg.label}
                </span>
              </div>
              {card.reason && (
                <p className="text-[11px] text-white/50 leading-snug">{card.reason}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LegacyScoreCardsGrid({ scoreCards }: { scoreCards: IngredientScanResult['scoreCards'] }) {
  const SCORE_CARDS_META = [
    { key: 'kids' as const, label: 'Kids', icon: '🧒' },
    { key: 'adults' as const, label: 'Adults', icon: '🧑' },
    { key: 'diet' as const, label: 'Your Diet', icon: '🥗' },
    { key: 'fitnessGoal' as const, label: 'Your Goal', icon: '🎯' },
  ];
  return (
    <div className="mb-5">
      <p className="text-xs font-bold uppercase tracking-wide text-white/40 mb-2">How it scores for you</p>
      <div className="grid grid-cols-2 gap-2">
        {SCORE_CARDS_META.map(({ key, label, icon }) => {
          const card = scoreCards[key];
          return (
            <div key={key} className={`rounded-xl border p-3 ${LEGACY_SCORE_BG[card.verdict]}`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-white/60">{icon} {label}</span>
                <LegacyScoreIcon verdict={card.verdict} />
              </div>
              {card.reason && (
                <p className="text-[11px] text-white/55 leading-snug">{card.reason}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const LAB_CONDITION_KEYWORDS = [
  'diabetes', 'glp-1', 'hypertension', 'cardiac', 'renal',
  'anti-inflammatory', 'oncology', 'thyroid', 'hashimoto', 'hormone',
];

function hasLabRelevantCondition(items: string[]): boolean {
  const joined = items.join(' ').toLowerCase();
  return LAB_CONDITION_KEYWORDS.some((kw) => joined.includes(kw));
}

function AnalysisProfileSection({ items }: { items: string[] }) {
  const showLabTeaser = items.length > 0 && hasLabRelevantCondition(items);

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 mb-3">
      <p className="text-xs font-bold uppercase tracking-wide text-orange-400/80 mb-2">
        Your Analysis Profile
      </p>
      {items.length > 0 ? (
        <>
          <p className="text-[11px] text-white/40 mb-2.5">This recommendation is based on:</p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {items.map((item) => (
              <span
                key={item}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-white/70 bg-white/8 border border-white/12 rounded-full px-2.5 py-1"
              >
                <span className="text-orange-400 text-[10px] font-bold">✓</span>
                {item}
              </span>
            ))}
          </div>

          {showLabTeaser && (
            <div className="rounded-lg bg-orange-500/8 border border-orange-500/20 px-3 py-2.5 mb-3 flex items-start gap-2.5">
              <span className="text-orange-400 text-base leading-none mt-0.5 shrink-0">⚗️</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white/75 mb-0.5">Want deeper personalization?</p>
                <p className="text-[11px] text-white/45 leading-snug mb-2">
                  Add lab values such as A1C, fasting glucose, cholesterol, triglycerides, kidney markers, or inflammation markers.
                </p>
                <a
                  href="/biometrics"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-400 bg-orange-500/15 border border-orange-500/30 rounded-full px-2.5 py-1"
                >
                  Update Health Profile →
                </a>
              </div>
            </div>
          )}

          <p className="text-[10px] text-white/25 leading-relaxed border-t border-white/8 pt-2.5">
            Recommendations are generated from ingredient composition, nutrition facts, and your health profile. MPM does not receive compensation from food manufacturers and recommendations are never influenced by brand partnerships.
          </p>
        </>
      ) : (
        <p className="text-xs text-white/45 leading-relaxed">
          Add health goals and conditions in your profile to get a fully personalized analysis.
        </p>
      )}
    </div>
  );
}

export function IngredientIntelligenceSheet({ open, result, onClose }: Props) {
  const grade = result ? GRADE_CONFIG[result.alignmentGrade] ?? GRADE_CONFIG.B : null;
  const verdictCfg = result ? VERDICT_CONFIG[result.verdictLevel ?? 'caution'] : null;
  const hasOutcomeCards = !!(result?.outcomeCards && result.outcomeCards.length > 0);

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

              {/* Analysis Profile — what data powered this result */}
              <AnalysisProfileSection items={result.analysisProfile ?? []} />

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

              {/* Phase 2 — Protocol Impact summary (aligns with / watch for) */}
              {hasOutcomeCards && <ProtocolImpactSummary cards={result.outcomeCards} />}

              {/* Phase 1 — Protocol Outcome Cards grid (or legacy fallback) */}
              {hasOutcomeCards
                ? <OutcomeCardsGrid cards={result.outcomeCards} />
                : result.scoreCards && <LegacyScoreCardsGrid scoreCards={result.scoreCards} />
              }

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
