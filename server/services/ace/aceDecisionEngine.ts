import type { AceDailyCheckin, CoachingProfile, CoachingIntervention } from "../../db/schema/ace";

type CheckinSignals = Pick<
  AceDailyCheckin,
  | "energy" | "stress" | "sleep" | "mood" | "cravings" | "hunger"
  | "digestion" | "soreness" | "schedule" | "motivation" | "emotionalEatingRisk"
  | "symptoms"
>;

type ScoredIntervention = CoachingIntervention & { score: number };

const SIGNAL_MAP: Array<{
  test: (s: CheckinSignals) => boolean;
  keys: string[];
  points: number;
}> = [
  { test: (s) => (s.energy ?? 3) <= 2, keys: ["low_energy", "dehydration_pattern"], points: 3 },
  { test: (s) => (s.energy ?? 3) === 1, keys: ["low_energy"], points: 2 },
  { test: (s) => (s.stress ?? 3) >= 4, keys: ["high_stress"], points: 3 },
  { test: (s) => (s.stress ?? 3) === 5, keys: ["binge_risk", "restrictive_spiral"], points: 1 },
  { test: (s) => (s.sleep ?? 3) <= 2, keys: ["sleep_deficit"], points: 3 },
  { test: (s) => (s.sleep ?? 3) === 1, keys: ["sleep_deficit", "low_energy"], points: 2 },
  { test: (s) => (s.mood ?? 3) <= 2, keys: ["low_motivation", "goal_drift"], points: 2 },
  { test: (s) => (s.mood ?? 3) === 1, keys: ["overeating_episode", "binge_risk"], points: 1 },
  { test: (s) => (s.cravings ?? 3) >= 4, keys: ["high_cravings"], points: 3 },
  { test: (s) => (s.cravings ?? 3) === 5, keys: ["binge_risk", "late_night_eating"], points: 2 },
  { test: (s) => (s.hunger ?? 3) === 1, keys: ["meal_skipping"], points: 2 },
  { test: (s) => (s.hunger ?? 3) === 5, keys: ["high_cravings", "late_night_eating"], points: 1 },
  { test: (s) => (s.digestion ?? 3) <= 2, keys: ["digestive_distress", "fiber_deficit"], points: 3 },
  { test: (s) => (s.soreness ?? 3) >= 4, keys: ["muscle_soreness"], points: 3 },
  { test: (s) => s.schedule === "travel", keys: ["travel"], points: 5 },
  { test: (s) => s.schedule === "busy", keys: ["meal_skipping", "low_motivation"], points: 2 },
  { test: (s) => (s.motivation ?? 3) <= 2, keys: ["low_motivation", "goal_drift"], points: 3 },
  { test: (s) => (s.motivation ?? 3) === 1, keys: ["low_motivation"], points: 2 },
  { test: (s) => (s.emotionalEatingRisk ?? 1) >= 4, keys: ["binge_risk", "high_cravings"], points: 3 },
  { test: (s) => (s.emotionalEatingRisk ?? 1) === 5, keys: ["restrictive_spiral", "binge_risk"], points: 3 },
];

const CHALLENGE_BOOSTS: Record<string, string[]> = {
  stress_eating: ["high_stress", "binge_risk", "late_night_eating"],
  low_energy: ["low_energy", "sleep_deficit", "dehydration_pattern"],
  cravings: ["high_cravings", "binge_risk"],
  motivation: ["low_motivation", "goal_drift"],
  meal_prep: ["meal_skipping", "low_motivation"],
  digestion: ["digestive_distress", "fiber_deficit"],
  sleep: ["sleep_deficit", "low_energy"],
  social_eating: ["social_eating", "high_cravings"],
  travel: ["travel", "meal_skipping"],
  weight_plateau: ["plateau", "goal_drift"],
  emotional_eating: ["binge_risk", "overeating_episode", "restrictive_spiral"],
  protein: ["protein_deficit"],
  hydration: ["dehydration_pattern"],
  hormones: ["hormonal_shifts", "high_cravings"],
  soreness: ["muscle_soreness"],
};

export function computeIntervention(
  checkin: CheckinSignals,
  profile: CoachingProfile | null,
  interventions: CoachingIntervention[]
): CoachingIntervention | null {
  if (interventions.length === 0) return null;

  const scores: Map<string, number> = new Map();
  const indexedByKey: Map<string, CoachingIntervention> = new Map();

  for (const iv of interventions) {
    scores.set(iv.key, 0);
    indexedByKey.set(iv.key, iv);
  }

  for (const rule of SIGNAL_MAP) {
    if (rule.test(checkin)) {
      for (const key of rule.keys) {
        if (scores.has(key)) {
          scores.set(key, (scores.get(key) ?? 0) + rule.points);
        }
      }
    }
  }

  if (profile?.biggestChallenges && profile.biggestChallenges.length > 0) {
    for (const challenge of profile.biggestChallenges) {
      const boosted = CHALLENGE_BOOSTS[challenge] ?? [];
      for (const key of boosted) {
        if (scores.has(key)) {
          scores.set(key, (scores.get(key) ?? 0) + 2);
        }
      }
    }
  }

  const sorted = [...scores.entries()]
    .filter(([, score]) => score > 0)
    .sort(([, a], [, b]) => b - a);

  if (sorted.length === 0) return null;

  const [topKey] = sorted[0];
  return indexedByKey.get(topKey) ?? null;
}

export function computeTopInterventions(
  checkin: CheckinSignals,
  profile: CoachingProfile | null,
  interventions: CoachingIntervention[],
  limit = 3
): CoachingIntervention[] {
  if (interventions.length === 0) return [];

  const scores: Map<string, number> = new Map();
  const indexedByKey: Map<string, CoachingIntervention> = new Map();

  for (const iv of interventions) {
    scores.set(iv.key, 0);
    indexedByKey.set(iv.key, iv);
  }

  for (const rule of SIGNAL_MAP) {
    if (rule.test(checkin)) {
      for (const key of rule.keys) {
        if (scores.has(key)) {
          scores.set(key, (scores.get(key) ?? 0) + rule.points);
        }
      }
    }
  }

  if (profile?.biggestChallenges && profile.biggestChallenges.length > 0) {
    for (const challenge of profile.biggestChallenges) {
      const boosted = CHALLENGE_BOOSTS[challenge] ?? [];
      for (const key of boosted) {
        if (scores.has(key)) {
          scores.set(key, (scores.get(key) ?? 0) + 2);
        }
      }
    }
  }

  return [...scores.entries()]
    .filter(([, score]) => score > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([key]) => indexedByKey.get(key)!)
    .filter(Boolean);
}
