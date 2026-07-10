export type CoachCornerFieldTarget =
  | "coachingStyle"
  | "accountabilityPref"
  | "motivations"
  | "lifestyleFlags"
  | "biggestChallenges";

export interface CoachCornerOption {
  value: string;
  label: string;
}

export interface CoachCornerQuestion {
  id: string;
  prompt: string;
  target: CoachCornerFieldTarget;
  multiSelect: boolean;
  maxSelect?: number;
  options: CoachCornerOption[];
}
