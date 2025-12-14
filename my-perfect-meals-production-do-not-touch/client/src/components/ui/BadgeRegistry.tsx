
import { 
  HeartPulse, 
  Pill, 
  Droplets, 
  ShieldAlert, 
  Flame, 
  Apple, 
  Ban, 
  Info,
  AlertCircle,
  Brain,
  Activity,
  Salad
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type BadgeType = "critical" | "important" | "info" | "default";

export interface BadgeDefinition {
  id: string;
  label: string;
  description?: string;
  icon: LucideIcon;
  type: BadgeType;
  category: "medical" | "dietary" | "lifestyle" | "general";
  keywords: string[];
}

export const BADGE_REGISTRY: Record<string, BadgeDefinition> = {
  // CRITICAL - Medical conditions requiring immediate attention
  "cardiac": {
    id: "cardiac",
    label: "Heart-Healthy",
    description: "Cardiac condition requiring low sodium, healthy fats",
    icon: HeartPulse,
    type: "critical",
    category: "medical",
    keywords: ["cardiac", "heart", "cardiovascular", "heart-healthy"]
  },
  "diabetes": {
    id: "diabetes",
    label: "Diabetic-Friendly",
    description: "Low glycemic index, blood sugar management",
    icon: Droplets,
    type: "critical",
    category: "medical",
    keywords: ["diabetes", "diabetic", "blood sugar", "glucose", "glycemic"]
  },
  "renal": {
    id: "renal",
    label: "Kidney-Friendly",
    description: "Low potassium, phosphorus, and protein restriction",
    icon: ShieldAlert,
    type: "critical",
    category: "medical",
    keywords: ["renal", "kidney", "ckd", "kidney-friendly"]
  },
  "glp1": {
    id: "glp1",
    label: "GLP-1 Optimized",
    description: "Supports GLP-1 medication therapy",
    icon: Pill,
    type: "critical",
    category: "medical",
    keywords: ["glp-1", "glp1", "ozempic", "wegovy", "mounjaro"]
  },
  "hypertension": {
    id: "hypertension",
    label: "Low Sodium",
    description: "Reduced sodium for blood pressure management",
    icon: Ban,
    type: "critical",
    category: "medical",
    keywords: ["hypertension", "blood pressure", "low sodium", "low salt", "sodium"]
  },

  // IMPORTANT - Significant dietary considerations
  "anti-inflammatory": {
    id: "anti-inflammatory",
    label: "Anti-Inflammatory",
    description: "Reduces inflammation, rich in omega-3s and antioxidants",
    icon: Flame,
    type: "important",
    category: "dietary",
    keywords: ["anti-inflammatory", "inflammation", "omega-3", "antioxidant"]
  },
  "low-cholesterol": {
    id: "low-cholesterol",
    label: "Low Cholesterol",
    description: "Heart-healthy fats, reduced saturated fat",
    icon: Activity,
    type: "important",
    category: "dietary",
    keywords: ["cholesterol", "low-fat", "heart-healthy"]
  },
  "gut-health": {
    id: "gut-health",
    label: "Gut Health",
    description: "Probiotic-rich, high fiber for digestive wellness",
    icon: Brain,
    type: "important",
    category: "dietary",
    keywords: ["gut health", "probiotic", "fiber", "digestive"]
  },

  // INFO - General health guidelines
  "general-health": {
    id: "general-health",
    label: "General Health",
    description: "Balanced nutrition for overall wellness",
    icon: Apple,
    type: "info",
    category: "general",
    keywords: ["general health", "healthy", "balanced", "wellness"]
  },
  "high-protein": {
    id: "high-protein",
    label: "High Protein",
    description: "Protein-rich for muscle building and satiety",
    icon: Salad,
    type: "info",
    category: "dietary",
    keywords: ["high protein", "protein", "muscle", "athlete"]
  },
  "allergen-free": {
    id: "allergen-free",
    label: "Allergen-Free",
    description: "Free from common allergens",
    icon: AlertCircle,
    type: "info",
    category: "dietary",
    keywords: ["allergen", "allergy", "free from", "restriction"]
  }
};

export function findBadgeDefinition(text: string): BadgeDefinition | null {
  const lowerText = text.toLowerCase();
  
  // Try exact match first
  const exactMatch = Object.values(BADGE_REGISTRY).find(
    def => def.id === lowerText || def.label.toLowerCase() === lowerText
  );
  if (exactMatch) return exactMatch;

  // Try keyword match
  const keywordMatch = Object.values(BADGE_REGISTRY).find(
    def => def.keywords.some(keyword => lowerText.includes(keyword))
  );
  if (keywordMatch) return keywordMatch;

  return null;
}

export function getBadgeIcon(text: string): LucideIcon {
  const definition = findBadgeDefinition(text);
  return definition?.icon || Info;
}

export function getBadgeType(text: string): BadgeType {
  const definition = findBadgeDefinition(text);
  return definition?.type || "default";
}

export function getBadgeDescription(text: string): string | undefined {
  const definition = findBadgeDefinition(text);
  return definition?.description;
}

export function getAllBadgesByCategory(category: BadgeDefinition["category"]) {
  return Object.values(BADGE_REGISTRY).filter(def => def.category === category);
}

export function getAllCriticalBadges() {
  return Object.values(BADGE_REGISTRY).filter(def => def.type === "critical");
}
