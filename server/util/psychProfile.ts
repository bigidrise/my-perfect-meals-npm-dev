export type PsychProfile = {
  disciplineLevel: "low"|"medium"|"high";
  stressCoping: "poor"|"average"|"good";
  motivation: "external"|"internal";
  focusLevel: "low"|"medium"|"high";
  // Optional extras you may already store:
  procrastination?: "low"|"medium"|"high";
  sleepQuality?: "poor"|"average"|"good";
};

export function profileToTags(profile?: Partial<PsychProfile>) {
  if (!profile) return [];
  const tags: string[] = [];
  switch (profile.disciplineLevel) {
    case "low": tags.push("low_consistency","needs_habit_help"); break;
    case "medium": tags.push("build_routine"); break;
    case "high": tags.push("refine_systems"); break;
  }
  switch (profile.stressCoping) {
    case "poor": tags.push("needs_resilience_boost","stress_mgmt"); break;
    case "average": tags.push("stress_refinement"); break;
    case "good": tags.push("maintain_resilience"); break;
  }
  switch (profile.motivation) {
    case "external": tags.push("build_internal_drive"); break;
    case "internal": tags.push("sustain_internal_drive"); break;
  }
  switch (profile.focusLevel) {
    case "low": tags.push("focus_training","reduce_distractions"); break;
    case "medium": tags.push("focus_progression"); break;
    case "high": tags.push("deep_work"); break;
  }
  if (profile.procrastination === "high") tags.push("anti_procrastination");
  if (profile.sleepQuality === "poor") tags.push("sleep_hygiene");
  return tags;
}