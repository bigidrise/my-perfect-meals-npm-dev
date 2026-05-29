export type LookupKey =
  | "mpm_basic"
  | "mpm_premium"
  | "mpm_ultimate"
  | "mpm_family_base"
  | "mpm_family_premium"
  | "mpm_family_ultimate"
  | "mpm_trainer_5"
  | "mpm_trainer_10"
  | "mpm_trainer_25"
  | "mpm_trainer_50"
  | "mpm_physician_50"
  | "mpm_physician_150"
  | "mpm_guidance"
  | "signature_kitchen_starter_monthly"
  | "signature_kitchen_pro_monthly"
  | "signature_kitchen_partner_monthly";

export type BillingCycle = "monthly";

export type PlanSku = {
  sku: LookupKey;
  label: string;
  price: number;
  seats?: number;
  clients?: number;
  hidden?: boolean;
  blurb?: string;
  supportingText?: string;
  features?: string[];
  group: "consumer" | "family" | "pro";
  badge?: string;
};

export const PLAN_SKUS: PlanSku[] = [
  {
    sku: "mpm_basic",
    label: "Essential",
    price: 19.99,
    group: "consumer",
    blurb: "Daily adaptive nutrition — AI meal generation, Recipe Scan, unlimited Ingredient Intelligence, and grocery organization",
    features: [
      "Create a Dish — AI meals built around your full profile",
      "Recipe Scan — photo or text import, rebuilt for your macros and protocols",
      "Ingredient Intelligence (unlimited — protocol-aware personalization)",
      "Unlimited AI Fridge Rescue",
      "Master Shopping List & Grocery Organization",
      "Weekly Meal Planner",
      "GLP-1, Diabetic & Anti-Inflammatory builders",
      "SafeGuard Allergy Protection (2-layer)",
      "Biometrics Tracking",
    ],
  },
  {
    sku: "mpm_premium",
    label: "Pro",
    price: 29.99,
    group: "consumer",
    blurb: "The full creator suite — every tool, every scan, every cuisine, every lifestyle",
    features: [
      "Everything in Essential",
      "Full Recipe Scan — camera, voice, and photo with 5-control customization and preview before saving",
      "Craving Creator, Snack Creator, Dessert Creator",
      "Beverage Creator & Sushi Creator",
      "Restaurant Guide with protocol-aware ordering",
      "Fast Food Guide & Find Meals Near Me",
      "My Perfect Gatherings (multi-course holiday, event & Great Outdoors meals)",
      "Spirits & Wine Pairing Hub",
      "My Perfect Pets — AI nutrition & meal plans for your pets",
    ],
    badge: "Most Popular",
  },
  {
    sku: "mpm_ultimate",
    label: "Clinical",
    price: 44.99,
    group: "consumer",
    blurb: "Advanced protocol and biomarker-guided adaptive nutrition — a different category entirely",
    features: [
      "Everything in Pro",
      "Clinical Lab Results Integration — blood work adjusts your meal protocols automatically",
      "Physicians & Trainers Care Team access",
      "Athlete Beverage Creator (calibrated to training phases)",
      "Beach Body / Hard Body Meal Builder",
      "Competition Prep Builder",
      "Clinical Advisory System",
    ],
  },

  {
    sku: "mpm_family_base",
    label: "Family Essential",
    price: 54.99,
    seats: 4,
    group: "family",
    blurb: "Daily adaptive nutrition for the whole household",
    supportingText: "Up to 4 personalized household profiles",
    features: [
      "Individual AI meal generation per profile",
      "Shared weekly meal planning",
      "Shared smart shopping lists",
      "Individual macro tracking and dietary preferences",
      "Family-friendly meal generation",
      "Parental controls",
    ],
    badge: "Best for Families",
  },
  {
    sku: "mpm_family_premium",
    label: "Family Pro",
    price: 109.99,
    seats: 4,
    group: "family",
    blurb: "The full creator suite for households with different needs",
    supportingText: "Pro features for up to 4 household profiles",
    features: [
      "Everything in Family Essential",
      "Full Recipe Scan for all profiles",
      "Advanced household meal customization",
      "Specialty diet support per member",
      "Restaurant and beverage recommendations",
      "Smart ingredient overlap optimization",
    ],
    badge: "Best Value",
  },
  {
    sku: "mpm_family_ultimate",
    label: "Family Clinical",
    price: 169.99,
    seats: 4,
    group: "family",
    blurb: "Clinical-grade AI nutrition for the whole household",
    supportingText: "Clinical features for up to 4 household profiles",
    features: [
      "Everything in Family Pro",
      "Clinical Lab Results Integration per profile",
      "Physicians & Trainers Care Team access",
      "AI-generated adaptive meal variations",
      "Advanced household wellness insights",
      "Voice-assisted meal planning",
    ],
  },

  {
    sku: "mpm_trainer_5",
    label: "ProCare Trainer 5",
    price: 49.99,
    group: "pro",
    clients: 5,
    blurb: "For trainers managing up to 5 clients",
    features: [
      "Manage up to 5 clients",
      "Client nutrition dashboards",
      "Assign meal builders",
      "Macro target management",
      "Messaging & progress tracking",
    ],
  },
  {
    sku: "mpm_trainer_10",
    label: "ProCare Trainer 10",
    price: 79.99,
    group: "pro",
    clients: 10,
    blurb: "For trainers managing up to 10 clients",
    features: [
      "Manage up to 10 clients",
      "Client nutrition dashboards",
      "Assign meal builders",
      "Macro target management",
      "Messaging & progress tracking",
    ],
  },
  {
    sku: "mpm_trainer_25",
    label: "ProCare Trainer 25",
    price: 119.99,
    group: "pro",
    clients: 25,
    blurb: "For trainers managing up to 25 clients",
    features: [
      "Manage up to 25 clients",
      "Client nutrition dashboards",
      "Assign meal builders",
      "Macro target management",
      "Messaging & progress tracking",
    ],
    badge: "Most Popular",
  },
  {
    sku: "mpm_trainer_50",
    label: "ProCare Trainer 50+",
    price: 149.99,
    group: "pro",
    clients: 50,
    blurb: "For trainers managing 50+ clients",
    features: [
      "Manage up to 50+ clients",
      "Client nutrition dashboards",
      "Assign meal builders",
      "Macro target management",
      "Messaging & progress tracking",
      "Priority support",
    ],
  },

  {
    sku: "mpm_physician_50",
    label: "ProCare Physician 50",
    price: 199.99,
    group: "pro",
    clients: 50,
    blurb: "For physicians managing up to 50 patients",
    features: [
      "Patient nutrition dashboards",
      "Medical nutrition protocols",
      "Assign meal builders",
      "Biometric tracking",
      "Messaging and progress monitoring",
    ],
  },
  {
    sku: "mpm_physician_150",
    label: "ProCare Physician 150",
    price: 399.99,
    group: "pro",
    clients: 150,
    blurb: "For clinics and large practices",
    features: [
      "Manage up to 150 patients",
      "Medical nutrition dashboards",
      "Biometric monitoring",
      "Patient progress tracking",
      "Advanced analytics",
    ],
  },

  {
    sku: "mpm_guidance",
    label: "Personal Guidance",
    price: 79.99,
    group: "pro",
    blurb: "Direct guidance from a My Perfect Meals coach",
    features: [
      "Direct nutrition coaching",
      "Custom meal adjustments",
      "Progress monitoring",
      "Priority support",
    ],
  },

  {
    sku: "signature_kitchen_starter_monthly",
    label: "Signature Kitchen Starter",
    price: 99,
    group: "pro",
    blurb: "Starter Kitchen — Monthly Access",
    features: [
      "Your kitchen, your name, your recipes in the app",
      "Up to 10 featured recipes",
      "Basic brand profile (photo, bio, links)",
      "Monthly analytics snapshot",
    ],
  },
  {
    sku: "signature_kitchen_pro_monthly",
    label: "Signature Kitchen Pro",
    price: 199,
    group: "pro",
    badge: "Most Popular",
    blurb: "Pro Kitchen — Monthly Access",
    features: [
      "Everything in Starter",
      "Up to 30 featured recipes",
      "Full brand integration (colors, assets, story)",
      "Priority placement in discovery",
      "Quarterly analytics report",
    ],
  },
  {
    sku: "signature_kitchen_partner_monthly",
    label: "Signature Kitchen Partner",
    price: 499,
    group: "pro",
    blurb: "Partner Kitchen — Monthly Access",
    features: [
      "Everything in Pro",
      "Unlimited featured recipes",
      "Full co-branded kitchen experience",
      "Featured in app onboarding and meal suggestions",
      "Dedicated account support",
      "Optional rev-share on plan upgrades you drive",
    ],
  },
];

export function getPlanBySku(sku: LookupKey): PlanSku | undefined {
  return PLAN_SKUS.find((p) => p.sku === sku);
}

export function getPublicPlans(): PlanSku[] {
  return PLAN_SKUS.filter((p) => !p.hidden);
}

export function getPlansByGroup(
  group: "consumer" | "family" | "pro",
): PlanSku[] {
  return PLAN_SKUS.filter((p) => p.group === group && !p.hidden);
}
