export type GlycemicSettings = {
  bloodGlucose: number | null;        // mg/dL, nullable if user hasn't set it
  preferredCarbs: string[];           // e.g. ["berries","broccoli"]
  updatedAt?: string | null;
};