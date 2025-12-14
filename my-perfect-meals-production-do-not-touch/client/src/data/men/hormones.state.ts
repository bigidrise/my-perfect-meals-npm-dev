export type MenHormonesState = {
  toggles: Partial<Record<string, boolean>>;
  quick: {
    sleepHours: number;
    trainedToday: boolean;
    stepsHit: boolean;
    alcohol: number;
    stress: "low"|"med"|"high";
  };
  weekly: { fish2: number; shellfish1: number; lifts3: number; sleep8x5: number; drinksLe5: number; steps5x8k: number; };
};
