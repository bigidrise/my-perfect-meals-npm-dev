export type MblState = {
  weightLbs: number; bodyFatPct: number; muscleMassLbs: number;
  energy: number; mood: number; lifestyleScore: number; visualStage: "fit"|"average"|"overweight";
};
export type MblInputs = { nutritionScore: number; trainingScore: number; lifestyleScore: number };

const clamp = (n:number, min:number, max:number) => Math.max(min, Math.min(max, n));

export function tickDay(s: MblState, i: MblInputs): MblState {
  const n = clamp(i.nutritionScore, 0, 100);
  const t = clamp(i.trainingScore, 0, 100);
  const l = clamp(i.lifestyleScore, 0, 100);

  const fatDelta = (50 - n) * 0.012;
  const muscleDelta = (t - 40) * 0.03;
  const weightDeltaFromFat = -(fatDelta * 0.25);
  const weightDeltaFromMuscle = muscleDelta * 0.1;

  let bodyFatPct      = clamp(s.bodyFatPct - fatDelta * 0.09, 6, 55);
  let muscleMassLbs   = clamp(s.muscleMassLbs + muscleDelta * 0.04, 40, 240);
  let weightLbs       = clamp(s.weightLbs + weightDeltaFromFat + weightDeltaFromMuscle, 70, 500);

  let energy          = clamp(s.energy + (l - 50) * 0.35 - Math.max(0, t - 75) * 0.25, 0, 100);
  let mood            = clamp(s.mood + (l - 50) * 0.25 + (n - 50) * 0.12, 0, 100);
  let lifestyleScore  = clamp((s.lifestyleScore * 0.7) + (l * 0.3), 0, 100);

  const stage: MblState["visualStage"] =
    bodyFatPct <= 18 && (muscleMassLbs / weightLbs) >= 0.35 ? "fit" :
    bodyFatPct >= 30 ? "overweight" : "average";

  return { weightLbs, bodyFatPct, muscleMassLbs, energy, mood, lifestyleScore, visualStage: stage };
}