export type WaistRiskLevel = "green" | "yellow" | "red";

export interface WaistRiskResult {
  ratio: number;
  level: WaistRiskLevel;
  label: string;
  description: string;
}

export function calculateWaistHeightRatio(
  waistCm: number,
  heightCm: number,
): number {
  if (heightCm <= 0) return 0;
  return Math.round((waistCm / heightCm) * 100) / 100;
}

export function classifyWaistRisk(ratio: number): WaistRiskResult {
  if (ratio <= 0) {
    return {
      ratio,
      level: "green",
      label: "Incomplete",
      description: "Enter waist and height to calculate risk.",
    };
  }
  if (ratio < 0.5) {
    return {
      ratio,
      level: "green",
      label: "Healthy",
      description:
        "Your waist-to-height ratio is in the healthy range. No nutritional adjustments needed.",
    };
  }
  if (ratio < 0.6) {
    return {
      ratio,
      level: "yellow",
      label: "Elevated",
      description:
        "Your waist-to-height ratio indicates elevated visceral fat risk. Reducing abdominal fat can improve cardiovascular health.",
    };
  }
  return {
    ratio,
    level: "red",
    label: "High Risk",
    description:
      "Your waist-to-height ratio indicates high cardiovascular and metabolic risk. Prioritizing fat loss around the midsection is strongly recommended.",
  };
}

export interface WaistRiskDeltas {
  protein: number;
  carbs: number;
  fat: number;
}

export function getWaistRiskDeltas(
  level: WaistRiskLevel,
  baseProtein: number,
  baseCarbs: number,
  baseFat: number,
): WaistRiskDeltas {
  switch (level) {
    case "green":
      return { protein: 0, carbs: 0, fat: 0 };
    case "yellow":
      return {
        protein: 0,
        carbs: -Math.round(baseCarbs * 0.1),
        fat: Math.round(baseFat * 0.05),
      };
    case "red":
      return {
        protein: Math.round(baseProtein * 0.05),
        carbs: -Math.round(baseCarbs * 0.2),
        fat: Math.round(baseFat * 0.1),
      };
  }
}
