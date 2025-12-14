import { create } from "zustand";
import { persist } from "zustand/middleware";
import { computeTargets, MacroTargets } from "@/utils/computeTargets";

export type Onboarding = {
  sex: "male" | "female";
  goal: "loss" | "maintenance" | "gain";
  desiredWeightLb: number;
  mealsPerDay: number;
  snacksPerDay: number;
  dietArchetype?: string;
  allergies?: string[];
  medicalFlags?: string[];
  cuisinePrefs?: string[];
};

type TargetsState = {
  onboarding: Onboarding | null;
  targets: MacroTargets | null;
  setOnboarding: (o: Onboarding) => void;
  clearTargets: () => void;
  isConfigured: () => boolean;
};

export const useTargetsStore = create<TargetsState>()(
  persist(
    (set, get) => ({
      onboarding: null,
      targets: null,
      
      setOnboarding: (o: Onboarding) => {
        const targets = computeTargets({
          goal: o.goal,
          sex: o.sex,
          desiredWeightLb: o.desiredWeightLb,
          mealsPerDay: o.mealsPerDay,
          snacksPerDay: o.snacksPerDay,
        }, "whole");
        
        set({
          onboarding: o,
          targets: targets,
        });
      },
      
      clearTargets: () => set({
        onboarding: null,
        targets: null,
      }),
      
      isConfigured: () => {
        const state = get();
        return !!(state.onboarding && state.targets);
      },
    }),
    {
      name: "targets-store",
      version: 1,
    }
  )
);