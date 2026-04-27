// server/services/creatorSystems/registry.ts
// Creator System Registry — plug-and-play slot for chef/coach/professional kitchens.
// Phase 1: pipe only. Add new systems here when a creator is onboarded.

export type CreatorSystemType = "system" | "chef" | "coach" | "physician" | "performance";

export interface CreatorSystem {
  id: string;
  name: string;
  type: CreatorSystemType;
}

export const creatorSystems: Record<string, CreatorSystem> = {
  default: {
    id: "default",
    name: "My Perfect Meals",
    type: "system",
  },

  test_system: {
    id: "test_system",
    name: "Test System",
    type: "chef",
  },
};
