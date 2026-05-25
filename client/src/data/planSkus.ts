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
    blurb: "AI meal generation with full clinical personalization",
    features: [
      "Create a Dish — AI meals built around your exact profile",
      "Recipe Scan — import any recipe from a photo or description",
      "MacroScan & Ingredient Intelligence",
      "GLP-1, Diabetic & Anti-Inflammatory builders",
      "Unlimited Fridge Rescue",
      "Weekly Meal Planner & Shopping List",
      "SafeGuard Allergy Protection",
      "Biometrics Tracking",
    ],
  },
  {
    sku: "mpm_premium",
    label: "Pro",
    price: 29.99,
    group: "consumer",
    blurb: "The full creator suite — every tool, every scan, every cuisine",
    features: [
      "Everything in Essential",
      "Full Recipe Scan with camera, voice & photo — customize servings, protein, prep style, cuisine before generating",
      "Craving Creator, Snack Creator, Dessert Creator",
      "Beverage Creator & Sushi Creator",
      "Restaurant Guide with protocol-aware ordering",
      "Fast Food Guide & Find Meals Near Me",
      "My Perfect Gatherings (multi-course holiday & event meals)",
      "Spirits & Wine Pairing Hub",
    ],
    badge: "Most Popular",
  },
  {
    sku: "mpm_ultimate",
    label: "Clinical",
    price: 44.99,
    group: "consumer",
    blurb: "Clinical-grade nutrition with lab integration and care team access",
    features: [
      "Everything in Pro",
      "Clinical Lab Results Integration — blood work drives your meal protocols automatically",
      "Physicians & Trainers Care Team access",
      "Athlete Beverage Creator",
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
    blurb: "Shared wellness support for modern households",
    supportingText: "Supports up to 4 personalized household profiles",
    features: [
      "Shared weekly meal planning",
      "Shared smart shopping lists",
      "Individual preferences and macro tracking per profile",
      "Family-friendly meal generation",
      "Basic dietary personalization",
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
    blurb: "Adaptive wellness support for households with different needs",
    supportingText: "Pro features for up to 4 household profiles",
    features: [
      "Everything included in Family Essential",
      "Full Recipe Scan for all profiles",
      "Advanced household meal customization",
      "Specialty diet support per member",
      "Restaurant and beverage recommendations",
      "Smart ingredient overlap optimization",
      "Expanded wellness personalization",
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
      "Everything included in Family Pro",
      "Clinical Lab Results Integration per profile",
      "Care Team access for all members",
      "AI-generated adaptive meal variations",
      "Advanced household wellness insights",
      "Voice-assisted meal planning",
      "Early access to future household AI features",
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
    blurb: "For trainers managing up to 50+ clients",
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
