export type CycleConfig = {
  defaultCycleLength: number;
  trackFields: ("energy"|"cravings"|"bloat"|"mood"|"notes")[];
  mapsToHintTags: Record<string, string[]>;
};

export const CYCLE_CONFIG: CycleConfig = {
  defaultCycleLength: 28,
  trackFields: ["energy","cravings","bloat","mood","notes"],
  mapsToHintTags: {
    bloat: ["easy-on-bloat","lower-sodium"],
    energy: ["protein-forward","slow-release"],
    cravings: ["lower-added-sugar","slow-release"],
    mood: ["omega-3","protein-forward"],
  },
};
