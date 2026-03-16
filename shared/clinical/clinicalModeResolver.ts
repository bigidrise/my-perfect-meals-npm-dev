import type { ClinicalMode } from '../schema/weeklyBoard';
import { BUILDER_NS } from '../builderNamespaces';
import type { BuilderNamespace } from '../builderNamespaces';

export interface ClinicalFlags {
  renal?: boolean;
  cardiac?: boolean;
  liverDisease?: boolean;
  liverSupport?: boolean;
  lowSodium?: boolean;
  diabetesFriendly?: boolean;
  glp1?: boolean;
  postBariatric?: boolean;
  [key: string]: boolean | undefined;
}

export interface ProtocolBadge {
  label: string;
  cls: string;
}

export interface ResolvedClinicalMode {
  mode: ClinicalMode;
  namespace: BuilderNamespace;
  primaryBadge: ProtocolBadge | null;
  modifierBadges: ProtocolBadge[];
}

const MODE_NAMESPACE_MAP: Record<ClinicalMode, BuilderNamespace> = {
  'anti-inflammatory': BUILDER_NS.ANTI_INFLAMMATORY,
  'liver-support':     BUILDER_NS.ANTI_INFLAMMATORY_LIVER,
  'kidney-disease':    BUILDER_NS.KIDNEY_DISEASE,
  'heart-failure':     BUILDER_NS.HEART_FAILURE,
  'liver-disease':     BUILDER_NS.LIVER_DISEASE,
};

/**
 * Resolves the active clinical mode from physician-set flags.
 *
 * Priority order (highest wins):
 *   1. kidney-disease  (renal flag)
 *   2. heart-failure   (cardiac flag)
 *   3. liver-disease   (liverDisease flag)
 *   4. liver-support   (liverSupport flag)
 *   5. anti-inflammatory (default)
 *
 * Modifier flags (lowSodium, diabetesFriendly, glp1, postBariatric) do not
 * change the mode — they appear as secondary directive badges only.
 */
export function resolveClinicalModeFromFlags(flags?: ClinicalFlags | null): ResolvedClinicalMode {
  const f = flags ?? {};

  let mode: ClinicalMode = 'anti-inflammatory';
  let primaryBadge: ProtocolBadge | null = null;

  if (f.renal) {
    mode = 'kidney-disease';
    primaryBadge = { label: 'Kidney Disease', cls: 'bg-sky-600 text-white' };
  } else if (f.cardiac) {
    mode = 'heart-failure';
    primaryBadge = { label: 'Cardiac Protocol', cls: 'bg-red-600 text-white' };
  } else if (f.liverDisease) {
    mode = 'liver-disease';
    primaryBadge = { label: 'Liver Disease', cls: 'bg-amber-600 text-white' };
  } else if (f.liverSupport) {
    mode = 'liver-support';
    primaryBadge = { label: 'Liver Support', cls: 'bg-emerald-600 text-white' };
  }

  const modifierBadges: ProtocolBadge[] = [];
  if (f.lowSodium)        modifierBadges.push({ label: 'Low-Sodium',        cls: 'bg-yellow-700 text-yellow-100' });
  if (f.diabetesFriendly) modifierBadges.push({ label: 'Diabetes-Friendly', cls: 'bg-purple-700 text-purple-100' });
  if (f.glp1)             modifierBadges.push({ label: 'GLP-1 Support',     cls: 'bg-blue-700 text-blue-100'    });
  if (f.postBariatric)    modifierBadges.push({ label: 'Post-Bariatric',    cls: 'bg-orange-700 text-orange-100' });

  return {
    mode,
    namespace: MODE_NAMESPACE_MAP[mode],
    primaryBadge,
    modifierBadges,
  };
}

/**
 * Returns the human-readable clinical protocol label for a given set of flags.
 * When no primary protocol flag is set, falls back to "Anti-Inflammatory".
 *
 * Use this anywhere the UI must show the active protocol name instead of the
 * raw builder name (e.g., dashboards, client cards, folder modals).
 */
export function resolveClinicalProtocolLabel(flags?: ClinicalFlags | null): string {
  const { primaryBadge } = resolveClinicalModeFromFlags(flags);
  return primaryBadge?.label ?? 'Anti-Inflammatory';
}
