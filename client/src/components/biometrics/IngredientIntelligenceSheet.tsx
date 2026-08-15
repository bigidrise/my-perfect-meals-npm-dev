import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, ChevronDown, ChevronUp, ScanLine, ShoppingBag, Bookmark, ShoppingCart, Check } from 'lucide-react';
import type { IngredientScanResult, ScoreVerdict, OutcomeVerdict, BetterAlternative } from '@/lib/photoIngredientCapture';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  result: IngredientScanResult | null;
  onClose: () => void;
  onRescan?: () => void;
  /** Shopping List context: add a specific named product directly to the list */
  onAddProduct?: (name: string) => void;
  /** Shopping List context: legacy fallback — show "Add to List" action button */
  onAddAnyway?: () => void;
  /** Shopping List context: show "Save Scan" action button */
  onSaveForReview?: () => void;
  /**
   * Called when a by-name analysis replaces the initial result (front-label fallback).
   * Allows the parent to update its authoritative result so Save, Last Analysis card,
   * and active scan state all reflect what the user sees in the sheet.
   */
  onResultRefined?: (result: IngredientScanResult) => void;
  /** Companion context: show companion header badge instead of default header */
  companionName?: string | null;
}

const GRADE_CONFIG = {
  A: { color: 'text-emerald-400', bg: 'bg-emerald-500/20 border-emerald-500/40', descKey: 'ingredientSheet.grade.a', glow: 'shadow-emerald-500/20' },
  B: { color: 'text-lime-400', bg: 'bg-lime-500/20 border-lime-500/40', descKey: 'ingredientSheet.grade.b', glow: 'shadow-lime-500/20' },
  C: { color: 'text-amber-400', bg: 'bg-amber-500/20 border-amber-500/40', descKey: 'ingredientSheet.grade.c', glow: 'shadow-amber-500/20' },
  D: { color: 'text-rose-400', bg: 'bg-rose-500/20 border-rose-500/40', descKey: 'ingredientSheet.grade.d', glow: 'shadow-rose-500/20' },
};

const VERDICT_CONFIG = {
  buy: { bg: 'bg-emerald-500/15 border-emerald-500/30', color: 'text-emerald-400', labelKey: 'ingredientSheet.verdict.buy' },
  caution: { bg: 'bg-amber-500/15 border-amber-500/30', color: 'text-amber-400', labelKey: 'ingredientSheet.verdict.caution' },
  skip: { bg: 'bg-rose-500/15 border-rose-500/30', color: 'text-rose-400', labelKey: 'ingredientSheet.verdict.skip' },
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
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);
  if (!items || items.length === 0) return null;
  return (
    <div className="mb-4">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between mb-2">
        <p className="text-xs font-bold uppercase tracking-wide text-white/40">🔬 {t('ingredientSheet.decoder.title')}</p>
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
              {t('ingredientSheet.decoder.legend')}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ProtocolImpactSummary({ cards }: { cards: IngredientScanResult['outcomeCards'] }) {
  const { t } = useTranslation();
  if (!cards || cards.length === 0) return null;
  const alignsWith = cards.filter(c => c.verdict === 'supports');
  const watchFor   = cards.filter(c => c.verdict === 'conflicts' || c.verdict === 'caution');
  if (alignsWith.length === 0 && watchFor.length === 0) return null;

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 mb-4 space-y-3">
      {alignsWith.length > 0 && (
        <div>
          <p className="text-xs font-bold text-emerald-400/80 uppercase tracking-wide mb-2">{t('ingredientSheet.alignsWith')}</p>
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
          <p className="text-xs font-bold text-amber-400/80 uppercase tracking-wide mb-2">{t('ingredientSheet.watchFor')}</p>
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
  const { t } = useTranslation();
  if (!cards || cards.length === 0) return null;
  return (
    <div className="mb-5">
      <p className="text-xs font-bold uppercase tracking-wide text-white/40 mb-2">{t('ingredientSheet.howItScores')}</p>
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

function BetterAlternativesSection({
  alternatives,
  branded,
  verdictLevel,
  onAddToList,
}: {
  alternatives: BetterAlternative[];
  branded?: boolean;
  verdictLevel?: string;
  onAddToList?: (name: string) => void;
}) {
  const { t } = useTranslation();
  const [addedIndex, setAddedIndex] = useState<number | null>(null);
  if (!alternatives || alternatives.length === 0) return null;

  const headingText = verdictLevel === 'buy'
    ? (branded ? `🏆 ${t('ingredientSheet.alternatives.alsoWorthKnowing')}` : `🏆 ${t('ingredientSheet.alternatives.evenBetter')}`)
    : `🛒 ${t('ingredientSheet.alternatives.betterOptions')}`;

  function handleAdd(name: string, i: number) {
    if (!onAddToList) return;
    onAddToList(name);
    setAddedIndex(i);
    setTimeout(() => setAddedIndex(null), 2000);
  }

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-bold text-white/80">{headingText}</p>
        {verdictLevel !== 'buy' && (
          <span className="text-[10px] font-semibold text-orange-400 bg-orange-500/15 border border-orange-500/25 rounded-full px-2 py-0.5 uppercase tracking-wide">
            {t('ingredientSheet.alternatives.profileMatched')}
          </span>
        )}
      </div>
      <div className="space-y-2.5">
        {alternatives.map((alt, i) => (
          <div key={i} className="rounded-xl border border-orange-500/25 bg-orange-500/8 p-3.5">
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="text-sm font-semibold text-white flex-1">{alt.category}</p>
              {onAddToList && (
                <button
                  onClick={() => handleAdd(alt.category, i)}
                  className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all active:scale-95 ${
                    addedIndex === i
                      ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300'
                      : 'bg-orange-600/80 border border-orange-500/50 text-white'
                  }`}
                >
                  {addedIndex === i
                    ? <><Check className="w-3 h-3" /> {t('ingredientSheet.added')}</>
                    : <><ShoppingCart className="w-3 h-3" /> {t('ingredientSheet.add')}</>
                  }
                </button>
              )}
            </div>
            {alt.whyBetter.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {alt.whyBetter.map((why, j) => (
                  <span key={j} className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-300 bg-emerald-500/15 border border-emerald-500/25 rounded-full px-2 py-0.5">
                    <span className="text-[9px] font-bold">✓</span>
                    {why}
                  </span>
                ))}
              </div>
            )}
            {alt.targetCriteria && (
              <p className="text-[11px] text-white/50 leading-snug border-t border-white/8 pt-2">
                📍 {alt.targetCriteria}
              </p>
            )}
          </div>
        ))}
      </div>
      <p className="text-[10px] text-white/20 mt-2 pl-1">
        {branded
          ? t('ingredientSheet.alternatives.brandedNote')
          : t('ingredientSheet.alternatives.categoryNote')}
      </p>
    </div>
  );
}

function ProfileFactorsSection({ factors }: { factors: string[] }) {
  const { t } = useTranslation();
  if (!factors || factors.length === 0) return null;
  return (
    <div className="rounded-xl border border-orange-500/20 bg-orange-500/6 p-3.5 mb-4">
      <p className="text-[10px] font-bold uppercase tracking-wide text-orange-400/70 mb-2">
        {t('ingredientSheet.profileFactorsHeading')}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {factors.map((factor, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-white/80 bg-white/8 border border-white/15 rounded-full px-2.5 py-1"
          >
            <span className="text-orange-400 text-[10px]">✓</span>
            {factor}
          </span>
        ))}
      </div>
    </div>
  );
}

function LegacyScoreCardsGrid({ scoreCards }: { scoreCards: IngredientScanResult['scoreCards'] }) {
  const { t } = useTranslation();
  const SCORE_CARDS_META = [
    { key: 'kids' as const, labelKey: 'ingredientSheet.scoreCards.kids', icon: '🧒' },
    { key: 'adults' as const, labelKey: 'ingredientSheet.scoreCards.adults', icon: '🧑' },
    { key: 'diet' as const, labelKey: 'ingredientSheet.scoreCards.diet', icon: '🥗' },
    { key: 'fitnessGoal' as const, labelKey: 'ingredientSheet.scoreCards.goal', icon: '🎯' },
  ];
  return (
    <div className="mb-5">
      <p className="text-xs font-bold uppercase tracking-wide text-white/40 mb-2">{t('ingredientSheet.howItScoresForYou')}</p>
      <div className="grid grid-cols-2 gap-2">
        {SCORE_CARDS_META.map(({ key, labelKey, icon }) => {
          const card = scoreCards[key];
          return (
            <div key={key} className={`rounded-xl border p-3 ${LEGACY_SCORE_BG[card.verdict]}`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-white/60">{icon} {t(labelKey)}</span>
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

function BarcodeDatabaseBadge({ resolvedFromDb, resolvedName }: { resolvedFromDb: boolean; resolvedName?: string }) {
  const { t } = useTranslation();
  if (resolvedFromDb) {
    return (
      <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/8 px-3.5 py-2.5 mb-4 flex items-center gap-2.5">
        <span className="text-emerald-400 text-base shrink-0">✓</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-emerald-300">{t('ingredientSheet.barcode.dbMatch')}</p>
          {resolvedName && (
            <p className="text-[11px] text-white/40 leading-tight truncate">{resolvedName}</p>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-amber-500/25 bg-amber-500/8 px-3.5 py-2.5 mb-4 flex items-center gap-2.5">
      <span className="text-amber-400 text-base shrink-0">≈</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-amber-300">{t('ingredientSheet.barcode.notInDb')}</p>
        <p className="text-[11px] text-white/40 leading-tight">
          {t('ingredientSheet.barcode.notFound')}
        </p>
      </div>
    </div>
  );
}
type AnalysisMethod = 'by_name' | 'by_label' | 'full_product_advisor';
const TIER_CONFIG: Record<AnalysisMethod, { labelKey: string; dot: string; border: string; bg: string; text: string }> = {
  by_name:             { labelKey: 'ingredientSheet.tier.quick',    dot: 'bg-amber-400',   border: 'border-amber-500/25',   bg: 'bg-amber-500/8',   text: 'text-amber-300' },
  by_label:            { labelKey: 'ingredientSheet.tier.verified', dot: 'bg-sky-400',     border: 'border-sky-500/25',     bg: 'bg-sky-500/8',     text: 'text-sky-300' },
  full_product_advisor:{ labelKey: 'ingredientSheet.tier.full',     dot: 'bg-emerald-400', border: 'border-emerald-500/25', bg: 'bg-emerald-500/8', text: 'text-emerald-300' },
};

function ConfidenceTierBadge({ method, productName, productNameMissing, onScanLabel }: {
  method: AnalysisMethod;
  productName?: string;
  productNameMissing?: boolean;
  onScanLabel?: () => void;
}) {
  const { t } = useTranslation();
  const cfg = TIER_CONFIG[method] ?? TIER_CONFIG.by_label;
  let sublabel = '';
  if (method === 'by_name') sublabel = t('ingredientSheet.tier.subKnowledge');
  else if (method === 'by_label' && productName) sublabel = t('ingredientSheet.tier.subLabelScanned', { name: productName });
  else if (method === 'by_label' && productNameMissing) sublabel = t('ingredientSheet.tier.subProductUnknown');
  else if (method === 'by_label') sublabel = t('ingredientSheet.tier.subLabel');
  else sublabel = t('ingredientSheet.tier.subFull');

  return (
    <div className={`rounded-xl border ${cfg.border} ${cfg.bg} px-3.5 py-2.5 mb-4 flex items-center justify-between gap-2`}>
      <div className="flex items-center gap-2.5">
        <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
        <div>
          <p className={`text-xs font-bold ${cfg.text}`}>{t(cfg.labelKey)}</p>
          <p className="text-[11px] text-white/40 leading-tight">{sublabel}</p>
        </div>
      </div>
      {method === 'by_name' && onScanLabel && (
        <button onClick={onScanLabel} className="text-[11px] text-orange-400 font-semibold shrink-0 active:opacity-70 transition-opacity">
          {t('ingredientSheet.scanLabelUp')}
        </button>
      )}
      {method === 'full_product_advisor' && (
        <span className="text-[11px] text-emerald-400 font-semibold shrink-0">{t('ingredientSheet.highestConfidence')}</span>
      )}
    </div>
  );
}

// ── What Matters Most For You ─────────────────────────────────────────────────
function WhatMattersMostSection({ items }: { items: string[] }) {
  const { t } = useTranslation();
  if (!items || items.length === 0) return null;
  return (
    <div className="rounded-2xl border border-orange-500/25 bg-orange-500/6 p-4 mb-4">
      <p className="text-xs font-bold uppercase tracking-wide text-orange-400 mb-3">⚡ {t('ingredientSheet.whatMattersMost')}</p>
      <ul className="space-y-2.5">
        {items.slice(0, 3).map((item, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0 mt-1.5" />
            <p className="text-sm text-white/85 leading-snug">{item}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AnalysisProfileSection({ items }: { items: string[] }) {
  const { t } = useTranslation();
  const showLabTeaser = items.length > 0 && hasLabRelevantCondition(items);

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 mb-3">
      <p className="text-xs font-bold uppercase tracking-wide text-orange-400/80 mb-2">
        {t('ingredientSheet.analysisProfile.heading')}
      </p>
      {items.length > 0 ? (
        <>
          <p className="text-[11px] text-white/40 mb-2.5">{t('ingredientSheet.analysisProfile.basedOn')}</p>
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
                <p className="text-xs font-semibold text-white/75 mb-0.5">{t('ingredientSheet.analysisProfile.deeperTitle')}</p>
                <p className="text-[11px] text-white/45 leading-snug mb-2">
                  {t('ingredientSheet.analysisProfile.deeperBody')}
                </p>
                <a
                  href="/biometrics"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-400 bg-orange-500/15 border border-orange-500/30 rounded-full px-2.5 py-1"
                >
                  {t('ingredientSheet.analysisProfile.updateProfile')}
                </a>
              </div>
            </div>
          )}

          <p className="text-[10px] text-white/25 leading-relaxed border-t border-white/8 pt-2.5">
            {t('ingredientSheet.analysisProfile.disclaimer')}
          </p>
        </>
      ) : (
        <p className="text-xs text-white/45 leading-relaxed">
          {t('ingredientSheet.analysisProfile.emptyState')}
        </p>
      )}
    </div>
  );
}

export function IngredientIntelligenceSheet({ open, result, onClose, onRescan, onAddProduct, onAddAnyway, onSaveForReview, onResultRefined, companionName }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [byNameLoading, setByNameLoading] = useState(false);
  const [byNameResult, setByNameResult] = useState<IngredientScanResult | null>(null);
  const [savedGroceryId, setSavedGroceryId] = useState<string | null>(null);
  const [savingGrocery, setSavingGrocery] = useState(false);

  useEffect(() => {
    setByNameResult(null);
    setByNameLoading(false);
  }, [result]);

  // Fetch the full saved-groceries list via React Query so any invalidation
  // (e.g. a delete from the Saved Groceries page) is picked up immediately.
  const { data: savedGroceriesData } = useQuery<{ items: any[] }>({
    queryKey: ['/api/saved-groceries'],
    enabled: open && !!result?.productName,
    staleTime: 0,
  });

  // Derive savedGroceryId from the cached list whenever the result or list changes
  useEffect(() => {
    const items = savedGroceriesData?.items ?? [];
    const barcode = result?.barcode?.trim();
    const match = items.find((item: any) => {
      if (barcode && item.barcode === barcode) return true;
      return item.productName?.toLowerCase() === result?.productName?.toLowerCase();
    });
    setSavedGroceryId(match ? match.id : null);
  }, [savedGroceriesData, result?.productName, result?.barcode]);

  // Invalidate saved-groceries when this tab regains visibility so a cross-tab
  // save is reflected as soon as the user switches back (recovery path).
  useEffect(() => {
    if (!open || !result?.productName) return;
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        queryClient.invalidateQueries({ queryKey: ['/api/saved-groceries'] });
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [open, result?.productName]);

  // Listen for saves/unsaves broadcast from other tabs via BroadcastChannel and
  // invalidate the React Query cache so this tab updates immediately.
  useEffect(() => {
    if (!open || !result?.productName) return;
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel('mpm:grocery-saved');
    channel.onmessage = () => {
      queryClient.invalidateQueries({ queryKey: ['/api/saved-groceries'] });
    };
    return () => channel.close();
  }, [open, result?.productName]);

  async function handleSaveToGroceries() {
    if (!activeResult?.productName || savingGrocery) return;
    setSavingGrocery(true);

    // If already saved, unsave it
    if (savedGroceryId) {
      try {
        await apiRequest(`/api/saved-groceries/${savedGroceryId}`, { method: 'DELETE' });
        queryClient.invalidateQueries({ queryKey: ['/api/saved-groceries'] });
        try { new BroadcastChannel('mpm:grocery-saved').postMessage(null); } catch { /* unavailable */ }
        toast({
          title: t('ingredientSheet.toast.removedTitle'),
          description: t('ingredientSheet.toast.removedDesc', { name: activeResult.productName }),
        });
      } catch {
        toast({ title: t('ingredientSheet.toast.removeFailTitle'), description: t('ingredientSheet.toast.tryAgain'), variant: 'destructive' });
      } finally {
        setSavingGrocery(false);
      }
      return;
    }

    try {
      const barcode = result?.barcode?.trim() || undefined;
      const data = await apiRequest('/api/saved-groceries', {
        method: 'POST',
        body: JSON.stringify({
          productName: activeResult.productName,
          source: 'scanner',
          barcode: barcode || undefined,
          nutritionJson: activeResult.scoreCards
            ? { scoreCards: activeResult.scoreCards, outcomeCards: activeResult.outcomeCards }
            : undefined,
          productMeta: {
            alignmentGrade: activeResult.alignmentGrade,
            verdictLevel: activeResult.verdictLevel,
            analysisMethod: activeResult.analysisMethod,
            // Persist extracted ingredients so the server-side compliance filter
            // can perform allergen/avoidance matching against actual ingredients,
            // not just product name and brand.
            ingredients: activeResult.extractedIngredients?.length
              ? activeResult.extractedIngredients
              : undefined,
            // Persist barcode DB resolution metadata so the badge is available
            // when a saved grocery is reopened in the sheet without a fresh scan.
            resolvedFromDb: activeResult.resolvedFromDb,
            resolvedName: activeResult.resolvedName ?? undefined,
          },
        }),
        headers: { 'Content-Type': 'application/json' },
      }) as { item?: { id: string }; created?: boolean };
      queryClient.invalidateQueries({ queryKey: ['/api/saved-groceries'] });
      try { new BroadcastChannel('mpm:grocery-saved').postMessage(null); } catch { /* unavailable */ }
      toast({
        title: data?.created === false ? t('ingredientSheet.toast.alreadySaved') : t('ingredientSheet.toast.savedTitle'),
        description: t('ingredientSheet.toast.savedDesc', { name: activeResult.productName }),
      });
    } catch {
      toast({ title: t('ingredientSheet.toast.saveFailTitle'), description: t('ingredientSheet.toast.tryAgain'), variant: 'destructive' });
    } finally {
      setSavingGrocery(false);
    }
  }

  function handleAddProduct(name: string) {
    if (!onAddProduct) return;
    onAddProduct(name);
    toast({ title: t('ingredientSheet.toast.addedToList'), description: name });
  }

  const activeResult = byNameResult ?? result;
  const grade = activeResult ? GRADE_CONFIG[activeResult.alignmentGrade] ?? GRADE_CONFIG.B : null;
  const verdictCfg = activeResult ? VERDICT_CONFIG[activeResult.verdictLevel ?? 'caution'] : null;
  const hasOutcomeCards = !!(activeResult?.outcomeCards && activeResult.outcomeCards.length > 0);
  const isByName = activeResult?.analysisMethod === 'by_name';
  const showFrontLabelChoice = !!(result?.isFrontLabel && !byNameResult && !byNameLoading);

  const handleAnalyzeByName = async () => {
    if (!result?.productName) return;
    setByNameLoading(true);
    try {
      const data = await apiRequest('/api/biometrics/ingredient-scan-by-name', {
        method: 'POST',
        body: JSON.stringify({ productName: result.productName }),
        headers: { 'Content-Type': 'application/json' },
      }) as { ok: boolean; result: IngredientScanResult };
      if (data.ok && data.result) {
        setByNameResult(data.result);
        // Propagate the refined result to the parent so Save, Last Analysis card,
        // and active scan state all reflect the same grade the user sees here.
        onResultRefined?.(data.result);
      }
    } catch {
      // silently fail — user can retry
    } finally {
      setByNameLoading(false);
    }
  };

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

              {/* Header */}
              <div className="flex items-center gap-3 mb-4">
                <img
                  src="/icons/ChefMascotLogo.png"
                  alt="Chef"
                  className="w-24 h-24 rounded-full object-cover border-2 border-orange-500/40"
                />
                <div className="flex-1">
                  <p className="text-xs text-orange-400 font-bold uppercase tracking-wide">
                    {companionName ? t('ingredientSheet.header.companionScan') : t('ingredientSheet.header.intelligence')}
                  </p>
                  <h2 className="text-white font-bold text-base leading-tight">
                    {result.productName || t('ingredientSheet.header.notIdentified')}
                  </h2>
                  {companionName ? (
                    <div className="mt-1 inline-flex items-center gap-1 bg-orange-600/20 border border-orange-500/30 rounded-full px-2 py-0.5">
                      <span className="text-[10px]">🐾</span>
                      <span className="text-orange-300 text-[10px] font-semibold">{t('ingredientSheet.header.scanningFor', { name: companionName })}</span>
                    </div>
                  ) : result.productName ? (
                    <p className="text-[11px] text-white/35 mt-0.5">
                      {showFrontLabelChoice ? t('ingredientSheet.header.frontLabelDetected') : isByName ? t('ingredientSheet.header.byNameAnalysis') : t('ingredientSheet.header.fullAnalysis')}
                    </p>
                  ) : null}
                </div>
                <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* ── PATH 1: Front label detected — show two-path choice ── */}
              {showFrontLabelChoice && (
                <motion.div className="space-y-3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  {/* Product detected card */}
                  <div className="rounded-2xl border border-orange-500/30 bg-orange-500/8 p-5 text-center">
                    <div className="text-3xl mb-2">📦</div>
                    <p className="text-[11px] text-orange-400 font-bold uppercase tracking-wide mb-1">{t('ingredientSheet.header.frontLabelDetected')}</p>
                    <p className="text-base font-bold text-white leading-snug">{result.productName}</p>
                  </div>

                  {/* Primary CTA */}
                  <button
                    onClick={handleAnalyzeByName}
                    className="w-full p-4 rounded-2xl bg-orange-600 text-white font-bold text-base active:scale-[0.98] transition-transform"
                  >
                    {t('ingredientSheet.analyzeThisProduct')}
                  </button>

                  {/* Secondary CTA */}
                  {onRescan && (
                    <button
                      onClick={onRescan}
                      className="w-full p-3.5 rounded-2xl bg-white/8 border border-white/15 text-white/65 font-medium text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                    >
                      <ScanLine className="w-4 h-4" />
                      {t('ingredientSheet.scanIngredientsLabel')}
                    </button>
                  )}

                  {/* Disclaimer */}
                  <p className="text-[11px] text-white/30 text-center leading-relaxed px-2 pt-1">
                    {t('ingredientSheet.analyzeDisclaimer')}
                  </p>
                </motion.div>
              )}

              {/* ── PATH 2: Loading by-name analysis ── */}
              {byNameLoading && (
                <motion.div
                  className="flex flex-col items-center justify-center gap-4 py-16"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                >
                  <div className="w-10 h-10 border-2 border-orange-400/40 border-t-orange-400 rounded-full animate-spin" />
                  <div className="text-center">
                    <p className="text-sm font-semibold text-white">{t('ingredientSheet.analyzing', { name: result.productName })}</p>
                    <p className="text-xs text-white/40 mt-1">{t('ingredientSheet.checkingProfile')}</p>
                  </div>
                </motion.div>
              )}

              {/* ── PATH 3: Full result (back-label scan or completed by-name analysis) ── */}
              {!showFrontLabelChoice && !byNameLoading && activeResult && (
                <>
                  {/* Confidence tier badge */}
                  <ConfidenceTierBadge
                    method={activeResult.analysisMethod}
                    productName={activeResult.productName || undefined}
                    productNameMissing={activeResult.productNameMissing}
                    onScanLabel={onRescan}
                  />

                  {/* Barcode database source badge — shown for barcode scans and saved
                      groceries whose productMeta preserved resolvedFromDb */}
                  {activeResult.resolvedFromDb !== undefined && (
                    <BarcodeDatabaseBadge
                      resolvedFromDb={activeResult.resolvedFromDb}
                      resolvedName={activeResult.resolvedName}
                    />
                  )}

                  {/* By-name accuracy banner */}
                  {isByName && (
                    <div className="rounded-xl border border-amber-500/25 bg-amber-500/8 p-3.5 mb-4 flex items-start gap-2.5">
                      <span className="text-base shrink-0 mt-0.5">⚠️</span>
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-amber-300 mb-0.5">{t('ingredientSheet.byNameBanner.title')}</p>
                        <p className="text-[11px] text-white/50 leading-snug">
                          {t('ingredientSheet.byNameBanner.body')}{' '}
                          {onRescan && (
                            <button
                              onClick={onRescan}
                              className="text-orange-400 font-semibold underline"
                            >
                              {t('ingredientSheet.byNameBanner.scanLink')}
                            </button>
                          )}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Scan quality warning */}
                  {!isByName && !activeResult.isFrontLabel && activeResult.ocrConfidenceLow && (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 mb-4 flex items-start gap-2.5">
                      <span className="text-base shrink-0 mt-0.5">⚠️</span>
                      <div>
                        <p className="text-xs font-semibold text-amber-300 mb-0.5">{t('ingredientSheet.lowQuality.title')}</p>
                        <p className="text-[11px] text-white/50 leading-snug">{t('ingredientSheet.lowQuality.body')}</p>
                      </div>
                    </div>
                  )}

                  {/* Product name missing — scan completeness prompt */}
                  {!isByName && activeResult.productNameMissing && (
                    <div className="rounded-xl border border-sky-500/25 bg-sky-500/8 p-3.5 mb-4 flex items-start gap-2.5">
                      <span className="text-base shrink-0 mt-0.5">💡</span>
                      <div>
                        <p className="text-xs font-semibold text-sky-300 mb-0.5">{t('ingredientSheet.labelFound.title')}</p>
                        <p className="text-[11px] text-white/50 leading-snug">{t('ingredientSheet.labelFound.body')}</p>
                      </div>
                    </div>
                  )}

                  {/* Grade banner — only shown when a grade was actually calculated */}
                  {activeResult.fallbackUsed ? (
                    <div className="rounded-2xl border border-white/15 bg-white/5 p-4 mb-3 flex items-start gap-3">
                      <div className="text-2xl shrink-0">🔍</div>
                      <div>
                        <p className="font-bold text-sm text-white/80">{t('ingredientSheet.incomplete.title')}</p>
                        <p className="text-xs text-white/45 mt-1 leading-snug">
                          {activeResult.ocrConfidenceLow
                            ? t('ingredientSheet.incomplete.lowImage')
                            : t('ingredientSheet.incomplete.needMore')}
                        </p>
                      </div>
                    </div>
                  ) : grade ? (
                    <div className={`rounded-2xl border p-4 mb-3 flex items-center gap-4 ${grade.bg} shadow-lg ${grade.glow}`}>
                      <div className={`text-6xl font-black leading-none ${grade.color}`}>{activeResult.alignmentGrade}</div>
                      <div>
                        <p className={`font-bold text-base ${grade.color}`}>{t(grade.descKey)}</p>
                        <p className="text-xs text-white/45 mt-0.5">
                          {activeResult.profileFactorsUsed && activeResult.profileFactorsUsed.length > 0
                            ? t('ingredientSheet.personalized')
                            : t('ingredientSheet.generalAnalysis')}
                        </p>
                      </div>
                    </div>
                  ) : null}

                  {/* Chef verdict */}
                  {verdictCfg && activeResult.verdict && (
                    <div className={`rounded-xl border p-3.5 mb-4 flex items-start gap-3 ${verdictCfg.bg}`}>
                      <img src="/icons/ChefMascotLogo.png" alt="" className="w-7 h-7 rounded-full shrink-0 mt-0.5 border border-orange-500/30" />
                      <div>
                        <p className={`text-xs font-bold uppercase tracking-wide mb-0.5 ${verdictCfg.color}`}>{t(verdictCfg.labelKey)}</p>
                        <p className="text-sm text-white/85 leading-snug">{activeResult.verdict}</p>
                      </div>
                    </div>
                  )}

                  {/* What Matters Most For You — condition-tied, 3 bullets max */}
                  <WhatMattersMostSection items={activeResult.whatMattersMost ?? []} />

                  {/* Better Product Options — always shown immediately after verdict */}
                  <BetterAlternativesSection
                    alternatives={activeResult.betterAlternatives ?? []}
                    branded={isByName || activeResult.analysisMethod === 'full_product_advisor'}
                    verdictLevel={activeResult.verdictLevel}
                    onAddToList={onAddProduct ? handleAddProduct : undefined}
                  />

                  {/* Profile factors driving this analysis */}
                  <ProfileFactorsSection factors={activeResult.profileFactorsUsed ?? []} />

                  {/* Overall coach summary */}
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4 mb-4">
                    <p className="text-sm text-white/85 leading-relaxed">{activeResult.overallSummary}</p>
                  </div>

                  {/* Protocol Impact summary */}
                  {hasOutcomeCards && <ProtocolImpactSummary cards={activeResult.outcomeCards} />}

                  {/* Protocol Outcome Cards grid */}
                  {hasOutcomeCards && <OutcomeCardsGrid cards={activeResult.outcomeCards} />}

                  {/* Legacy scoreCards */}
                  {activeResult.scoreCards && <LegacyScoreCardsGrid scoreCards={activeResult.scoreCards} />}

                  {/* Analysis profile — moved to bottom as reference info */}
                  <AnalysisProfileSection items={activeResult.analysisProfile ?? []} />

                  {/* Plain English Decoder */}
                  <IngredientDecoder items={activeResult.ingredientDecoder ?? []} />

                  {/* Ingredient sections */}
                  <Section title={t('ingredientSheet.sections.considerations')} items={activeResult.ingredientConsiderations} icon="🔍" />
                  <Section title={t('ingredientSheet.sections.mayNotAlign')} items={activeResult.mayNotAlignWith} icon="⚠️" />
                  <Section title={t('ingredientSheet.sections.worksWellFor')} items={activeResult.betterFor} icon="✓" />
                  <Section title={t('ingredientSheet.sections.familyNotes')} items={activeResult.householdNotes} icon="🏠" />

                  {/* Detected ingredients (collapsed) — back-label path only */}
                  {!isByName && activeResult.extractedIngredients.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-white/40 mb-2">📋 {t('ingredientSheet.detectedIngredients')}</p>
                      <div className="rounded-xl border border-white/10 bg-black/30 p-3 max-h-24 overflow-y-auto">
                        <p className="text-xs text-white/40 leading-relaxed">
                          {activeResult.extractedIngredients.join(', ')}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Quick Analysis: scan label upgrade CTA */}
                  {isByName && onRescan && (
                    <button
                      onClick={onRescan}
                      className="w-full mt-2 mb-4 p-3.5 rounded-2xl bg-orange-600/15 border border-orange-500/30 text-orange-300 font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                    >
                      <ScanLine className="w-4 h-4" />
                      {t('ingredientSheet.scanForVerified')}
                    </button>
                  )}

                  {/* Shopping context action buttons */}
                  {(onAddProduct || onAddAnyway || onSaveForReview) && (
                    <div className="space-y-2 mt-2 mb-4">
                      {/* Direct add — uses productName, no typing required */}
                      {onAddProduct && activeResult.productName && (
                        <button
                          onClick={() => handleAddProduct(activeResult.productName)}
                          className="w-full flex items-center justify-center gap-2 bg-orange-600 rounded-2xl py-3.5 text-white font-semibold text-sm active:scale-[.98] transition-transform"
                        >
                          <ShoppingCart className="w-4 h-4" />
                          {t('ingredientSheet.addNamedToList', { name: activeResult.productName })}
                        </button>
                      )}
                      {/* Legacy fallback: no productName but onAddAnyway exists */}
                      {!onAddProduct && onAddAnyway && (
                        <>
                          <button
                            onClick={onAddAnyway}
                            className="w-full flex items-center justify-center gap-2 bg-orange-600 rounded-2xl py-3.5 text-white font-semibold text-sm active:scale-[.98] transition-transform"
                          >
                            <ShoppingBag className="w-4 h-4" />
                            {t('ingredientSheet.addToList')}
                          </button>
                        </>
                      )}
                      {onSaveForReview && (
                        <button
                          onClick={onSaveForReview}
                          className="w-full flex items-center justify-center gap-1.5 bg-white/8 border border-white/10 rounded-xl py-3 text-white/70 text-sm"
                        >
                          <Bookmark className="w-3.5 h-3.5" />
                          {t('ingredientSheet.saveScan')}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Save to Groceries */}
                  {activeResult.productName && (
                    <div className="mt-2 mb-4">
                      <button
                        onClick={handleSaveToGroceries}
                        disabled={savingGrocery}
                        className={`w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold border transition-all active:scale-[.98] ${
                          savedGroceryId
                            ? 'bg-orange-500/15 border-orange-500/30 text-orange-300'
                            : 'bg-white/6 border-white/12 text-white/60 hover:border-white/20 hover:text-white/80'
                        } ${savingGrocery ? 'opacity-60 pointer-events-none' : ''}`}
                      >
                        <Bookmark
                          className="w-4 h-4"
                          fill={savedGroceryId ? 'currentColor' : 'none'}
                        />
                        {savedGroceryId ? t('ingredientSheet.savedToGroceries') : t('ingredientSheet.saveToGroceries')}
                      </button>
                    </div>
                  )}

                  {/* Footer */}
                  <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-2 justify-center">
                    <img src="/icons/ChefMascotLogo.png" alt="" className="w-5 h-5 rounded-full opacity-50" />
                    <p className="text-[10px] text-white/25 leading-relaxed text-center">
                      {activeResult.educationalFooter}
                    </p>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
