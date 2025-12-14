
import type { GLP1Guardrails } from "../../../shared/glp1-schema";

export type GLP1Preset = {
  id: string;
  label: string;
  description: string;
  values: GLP1Guardrails;
};

export const glp1Presets: GLP1Preset[] = [
  {
    id: "intro_titration",
    label: "Intro / Up-Titration",
    description: "Smallest meals, lowest fat — early dose stage.",
    values: {
      maxMealVolumeMl: 250,
      proteinMinG: 25,
      fatMaxG: 10,
      fiberMinG: 25,
      hydrationMinMl: 2200,
      mealsPerDay: 5,
      slowDigestOnly: true,
      limitCarbonation: true,
      limitAlcohol: true,
    },
  },
  {
    id: "maintenance",
    label: "Maintenance",
    description: "Stable dose, balanced macros, steady hydration.",
    values: {
      maxMealVolumeMl: 300,
      proteinMinG: 30,
      fatMaxG: 15,
      fiberMinG: 28,
      hydrationMinMl: 2000,
      mealsPerDay: 4,
      slowDigestOnly: true,
      limitCarbonation: true,
      limitAlcohol: true,
    },
  },
  {
    id: "muscle_preserve",
    label: "Refeed / Strength Focus",
    description: "Higher protein for lean-mass preservation.",
    values: {
      maxMealVolumeMl: 350,
      proteinMinG: 40,
      fatMaxG: 15,
      fiberMinG: 30,
      hydrationMinMl: 2500,
      mealsPerDay: 4,
      slowDigestOnly: true,
      limitCarbonation: true,
      limitAlcohol: false,
    },
  },
];
