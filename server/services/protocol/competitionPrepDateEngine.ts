/**
 * competitionPrepDateEngine.ts
 *
 * Pure deterministic function — no AI, no randomness.
 * Takes (eventDate, competitionType) → returns current phase + full timeline.
 *
 * The event date IS the safeguard. The calendar drives every decision.
 * Pattern mirrors pregnancyUtils.ts → derivePregnancyStatus().
 */

export type CompetitionType =
  | "bodybuilding_show" | "mens_physique" | "classic_physique"
  | "figure" | "bikini" | "wellness"
  | "powerlifting_meet" | "strongman_competition" | "olympic_weightlifting_meet"
  | "fight_camp" | "wrestling_season"
  | "crossfit_competition" | "hyrox"
  | "marathon" | "triathlon_race" | "spartan_race";

export type CompPrepPhase =
  | "fat_loss"
  | "conditioning"
  | "peak_prep"
  | "peak_week"
  | "show_day"
  | "post_competition"
  | "strength_building"
  | "intensity_phase"
  | "taper"
  | "meet_week"
  | "meet_day"
  | "conditioning_combat"
  | "fight_prep"
  | "weight_cut"
  | "fight_week"
  | "fight_day"
  | "pre_season"
  | "in_season"
  | "championship_week"
  | "match_day"
  | "off_season"
  | "base_conditioning"
  | "event_prep"
  | "competition_week"
  | "competition_day"
  | "base_building"
  | "build_phase"
  | "race_prep"
  | "race_day"
  | "post_race";

export interface CompPrepStatus {
  weeksOut: number;
  daysOut: number;
  currentPhase: CompPrepPhase;
  currentPhaseLabel: string;
  /** Weeks until the next phase transition (null = current phase is the last one) */
  weeksToNextPhase: number | null;
  nextPhaseLabel: string | null;
  isPeakWeek: boolean;
  isEventDay: boolean;
  isPostEvent: boolean;
  /** Approximate end of post-event recovery window */
  recoveryEndsDate: string;
  /** Color theme for the UI: "green" | "yellow" | "orange" | "red" | "blue" */
  phaseColor: "green" | "yellow" | "orange" | "red" | "blue";
  /** Category used to route UMG guidance block content */
  category: "physique" | "strength" | "combat" | "wrestling" | "functional" | "endurance";
}

function weeksFromNow(eventDate: string): { weeks: number; days: number } {
  const event = new Date(eventDate);
  // Normalize to start of day to avoid timezone drift
  event.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const msOut = event.getTime() - today.getTime();
  const days = Math.round(msOut / (24 * 60 * 60 * 1000));
  const weeks = Math.floor(days / 7);
  return { weeks, days };
}

function addWeeks(date: string, weeksToAdd: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + weeksToAdd * 7);
  return d.toISOString().split("T")[0];
}

export function deriveCompPrepStatus(
  eventDate: string,
  competitionType: CompetitionType
): CompPrepStatus {
  const { weeks, days } = weeksFromNow(eventDate);

  // ── Physique sports ───────────────────────────────────────────────────────
  const isPhysique = ["bodybuilding_show", "mens_physique", "classic_physique", "figure", "bikini", "wellness"].includes(competitionType);
  if (isPhysique) {
    if (days < 0) return mkStatus({ weeks, days, phase: "post_competition", label: "Post-Show Recovery", color: "blue", isPeak: false, isDay: false, isPost: true, nextPhase: null, nextLabel: null, weeksToNext: null, recoveryWeeks: 4, eventDate, category: "physique" });
    if (days === 0) return mkStatus({ weeks, days, phase: "show_day", label: "Show Day", color: "orange", isPeak: true, isDay: true, isPost: false, nextPhase: null, nextLabel: null, weeksToNext: null, recoveryWeeks: 4, eventDate, category: "physique" });
    if (weeks <= 2) return mkStatus({ weeks, days, phase: "peak_week", label: "Peak Week", color: "orange", isPeak: true, isDay: false, isPost: false, nextPhase: "show_day", nextLabel: "Show Day", weeksToNext: weeks, recoveryWeeks: 4, eventDate, category: "physique" });
    if (weeks <= 7) return mkStatus({ weeks, days, phase: "peak_prep", label: "Peak Prep", color: "yellow", isPeak: false, isDay: false, isPost: false, nextPhase: "peak_week", nextLabel: "Peak Week", weeksToNext: weeks - 2, recoveryWeeks: 4, eventDate, category: "physique" });
    if (weeks <= 15) return mkStatus({ weeks, days, phase: "conditioning", label: "Conditioning Phase", color: "yellow", isPeak: false, isDay: false, isPost: false, nextPhase: "peak_prep", nextLabel: "Peak Prep", weeksToNext: weeks - 7, recoveryWeeks: 4, eventDate, category: "physique" });
    return mkStatus({ weeks, days, phase: "fat_loss", label: "Fat Loss Phase", color: "green", isPeak: false, isDay: false, isPost: false, nextPhase: "conditioning", nextLabel: "Conditioning Phase", weeksToNext: weeks - 15, recoveryWeeks: 4, eventDate, category: "physique" });
  }

  // ── Strength sports ───────────────────────────────────────────────────────
  const isStrength = ["powerlifting_meet", "strongman_competition", "olympic_weightlifting_meet"].includes(competitionType);
  if (isStrength) {
    if (days < 0) return mkStatus({ weeks, days, phase: "post_competition", label: "Post-Meet Recovery", color: "blue", isPeak: false, isDay: false, isPost: true, nextPhase: null, nextLabel: null, weeksToNext: null, recoveryWeeks: 2, eventDate, category: "strength" });
    if (days === 0) return mkStatus({ weeks, days, phase: "meet_day", label: "Meet Day", color: "orange", isPeak: true, isDay: true, isPost: false, nextPhase: null, nextLabel: null, weeksToNext: null, recoveryWeeks: 2, eventDate, category: "strength" });
    if (weeks <= 1) return mkStatus({ weeks, days, phase: "meet_week", label: "Meet Week", color: "orange", isPeak: true, isDay: false, isPost: false, nextPhase: "meet_day", nextLabel: "Meet Day", weeksToNext: weeks, recoveryWeeks: 2, eventDate, category: "strength" });
    if (weeks <= 3) return mkStatus({ weeks, days, phase: "taper", label: "Taper Phase", color: "yellow", isPeak: false, isDay: false, isPost: false, nextPhase: "meet_week", nextLabel: "Meet Week", weeksToNext: weeks - 1, recoveryWeeks: 2, eventDate, category: "strength" });
    if (weeks <= 9) return mkStatus({ weeks, days, phase: "intensity_phase", label: "Intensity Phase", color: "yellow", isPeak: false, isDay: false, isPost: false, nextPhase: "taper", nextLabel: "Taper", weeksToNext: weeks - 3, recoveryWeeks: 2, eventDate, category: "strength" });
    return mkStatus({ weeks, days, phase: "strength_building", label: "Strength Building", color: "green", isPeak: false, isDay: false, isPost: false, nextPhase: "intensity_phase", nextLabel: "Intensity Phase", weeksToNext: weeks - 9, recoveryWeeks: 2, eventDate, category: "strength" });
  }

  // ── Combat sports — fight camp ─────────────────────────────────────────────
  if (competitionType === "fight_camp") {
    if (days < 0) return mkStatus({ weeks, days, phase: "post_competition", label: "Post-Fight Recovery", color: "blue", isPeak: false, isDay: false, isPost: true, nextPhase: null, nextLabel: null, weeksToNext: null, recoveryWeeks: 2, eventDate, category: "combat" });
    if (days === 0) return mkStatus({ weeks, days, phase: "fight_day", label: "Fight Day", color: "orange", isPeak: true, isDay: true, isPost: false, nextPhase: null, nextLabel: null, weeksToNext: null, recoveryWeeks: 2, eventDate, category: "combat" });
    if (weeks <= 1) return mkStatus({ weeks, days, phase: "fight_week", label: "Fight Week", color: "red", isPeak: true, isDay: false, isPost: false, nextPhase: "fight_day", nextLabel: "Fight Day", weeksToNext: weeks, recoveryWeeks: 2, eventDate, category: "combat" });
    if (weeks <= 3) return mkStatus({ weeks, days, phase: "weight_cut", label: "Weight Cut", color: "red", isPeak: false, isDay: false, isPost: false, nextPhase: "fight_week", nextLabel: "Fight Week", weeksToNext: weeks - 1, recoveryWeeks: 2, eventDate, category: "combat" });
    if (weeks <= 11) return mkStatus({ weeks, days, phase: "fight_prep", label: "Fight Prep", color: "yellow", isPeak: false, isDay: false, isPost: false, nextPhase: "weight_cut", nextLabel: "Weight Cut", weeksToNext: weeks - 3, recoveryWeeks: 2, eventDate, category: "combat" });
    return mkStatus({ weeks, days, phase: "conditioning_combat", label: "Conditioning Camp", color: "green", isPeak: false, isDay: false, isPost: false, nextPhase: "fight_prep", nextLabel: "Fight Prep", weeksToNext: weeks - 11, recoveryWeeks: 2, eventDate, category: "combat" });
  }

  // ── Wrestling season ──────────────────────────────────────────────────────
  if (competitionType === "wrestling_season") {
    if (days < 0) return mkStatus({ weeks, days, phase: "off_season", label: "Off-Season", color: "blue", isPeak: false, isDay: false, isPost: true, nextPhase: null, nextLabel: null, weeksToNext: null, recoveryWeeks: 4, eventDate, category: "wrestling" });
    if (days === 0) return mkStatus({ weeks, days, phase: "match_day", label: "Match Day", color: "orange", isPeak: true, isDay: true, isPost: false, nextPhase: null, nextLabel: null, weeksToNext: null, recoveryWeeks: 4, eventDate, category: "wrestling" });
    if (weeks <= 1) return mkStatus({ weeks, days, phase: "championship_week", label: "Championship Week", color: "orange", isPeak: true, isDay: false, isPost: false, nextPhase: "match_day", nextLabel: "Match Day", weeksToNext: weeks, recoveryWeeks: 4, eventDate, category: "wrestling" });
    if (weeks <= 7) return mkStatus({ weeks, days, phase: "in_season", label: "In-Season", color: "yellow", isPeak: false, isDay: false, isPost: false, nextPhase: "championship_week", nextLabel: "Championship Week", weeksToNext: weeks - 1, recoveryWeeks: 4, eventDate, category: "wrestling" });
    return mkStatus({ weeks, days, phase: "pre_season", label: "Pre-Season", color: "green", isPeak: false, isDay: false, isPost: false, nextPhase: "in_season", nextLabel: "In-Season", weeksToNext: weeks - 7, recoveryWeeks: 4, eventDate, category: "wrestling" });
  }

  // ── Functional / mixed fitness (CrossFit, Hyrox) ──────────────────────────
  const isFunctional = ["crossfit_competition", "hyrox"].includes(competitionType);
  if (isFunctional) {
    if (days < 0) return mkStatus({ weeks, days, phase: "post_competition", label: "Post-Event Recovery", color: "blue", isPeak: false, isDay: false, isPost: true, nextPhase: null, nextLabel: null, weeksToNext: null, recoveryWeeks: 2, eventDate, category: "functional" });
    if (days === 0) return mkStatus({ weeks, days, phase: "competition_day", label: "Competition Day", color: "orange", isPeak: true, isDay: true, isPost: false, nextPhase: null, nextLabel: null, weeksToNext: null, recoveryWeeks: 2, eventDate, category: "functional" });
    if (weeks <= 1) return mkStatus({ weeks, days, phase: "competition_week", label: "Competition Week", color: "orange", isPeak: true, isDay: false, isPost: false, nextPhase: "competition_day", nextLabel: "Competition Day", weeksToNext: weeks, recoveryWeeks: 2, eventDate, category: "functional" });
    if (weeks <= 3) return mkStatus({ weeks, days, phase: "peak_prep", label: "Peak Prep", color: "yellow", isPeak: false, isDay: false, isPost: false, nextPhase: "competition_week", nextLabel: "Competition Week", weeksToNext: weeks - 1, recoveryWeeks: 2, eventDate, category: "functional" });
    if (weeks <= 7) return mkStatus({ weeks, days, phase: "event_prep", label: "Event Prep", color: "yellow", isPeak: false, isDay: false, isPost: false, nextPhase: "peak_prep", nextLabel: "Peak Prep", weeksToNext: weeks - 3, recoveryWeeks: 2, eventDate, category: "functional" });
    return mkStatus({ weeks, days, phase: "base_conditioning", label: "Base Conditioning", color: "green", isPeak: false, isDay: false, isPost: false, nextPhase: "event_prep", nextLabel: "Event Prep", weeksToNext: weeks - 7, recoveryWeeks: 2, eventDate, category: "functional" });
  }

  // ── Endurance events (marathon, triathlon, spartan) ───────────────────────
  const isEndurance = ["marathon", "triathlon_race", "spartan_race"].includes(competitionType);
  if (isEndurance) {
    if (days < 0) return mkStatus({ weeks, days, phase: "post_race", label: "Post-Race Recovery", color: "blue", isPeak: false, isDay: false, isPost: true, nextPhase: null, nextLabel: null, weeksToNext: null, recoveryWeeks: 2, eventDate, category: "endurance" });
    if (days === 0) return mkStatus({ weeks, days, phase: "race_day", label: "Race Day", color: "orange", isPeak: true, isDay: true, isPost: false, nextPhase: null, nextLabel: null, weeksToNext: null, recoveryWeeks: 2, eventDate, category: "endurance" });
    if (weeks <= 3) return mkStatus({ weeks, days, phase: "taper", label: "Taper Phase", color: "orange", isPeak: false, isDay: false, isPost: false, nextPhase: "race_day", nextLabel: "Race Day", weeksToNext: weeks, recoveryWeeks: 2, eventDate, category: "endurance" });
    if (weeks <= 7) return mkStatus({ weeks, days, phase: "race_prep", label: "Race Prep (Peak Training)", color: "yellow", isPeak: false, isDay: false, isPost: false, nextPhase: "taper", nextLabel: "Taper", weeksToNext: weeks - 3, recoveryWeeks: 2, eventDate, category: "endurance" });
    if (weeks <= 15) return mkStatus({ weeks, days, phase: "build_phase", label: "Build Phase", color: "yellow", isPeak: false, isDay: false, isPost: false, nextPhase: "race_prep", nextLabel: "Race Prep", weeksToNext: weeks - 7, recoveryWeeks: 2, eventDate, category: "endurance" });
    return mkStatus({ weeks, days, phase: "base_building", label: "Base Building", color: "green", isPeak: false, isDay: false, isPost: false, nextPhase: "build_phase", nextLabel: "Build Phase", weeksToNext: weeks - 15, recoveryWeeks: 2, eventDate, category: "endurance" });
  }

  // Fallback
  return mkStatus({ weeks, days, phase: "fat_loss", label: "Prep Phase", color: "green", isPeak: false, isDay: false, isPost: false, nextPhase: null, nextLabel: null, weeksToNext: null, recoveryWeeks: 2, eventDate, category: "physique" });
}

interface MkArgs {
  weeks: number; days: number;
  phase: CompPrepPhase; label: string;
  color: CompPrepStatus["phaseColor"];
  isPeak: boolean; isDay: boolean; isPost: boolean;
  nextPhase: string | null; nextLabel: string | null; weeksToNext: number | null;
  recoveryWeeks: number; eventDate: string;
  category: CompPrepStatus["category"];
}
function mkStatus(a: MkArgs): CompPrepStatus {
  return {
    weeksOut: a.weeks,
    daysOut: a.days,
    currentPhase: a.phase,
    currentPhaseLabel: a.label,
    weeksToNextPhase: a.weeksToNext,
    nextPhaseLabel: a.nextLabel,
    isPeakWeek: a.isPeak,
    isEventDay: a.isDay,
    isPostEvent: a.isPost,
    recoveryEndsDate: addWeeks(a.eventDate, a.recoveryWeeks),
    phaseColor: a.color,
    category: a.category,
  };
}
