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
  features?: string[];
  group: "consumer" | "family" | "pro";
  badge?: string;
};

export const PLAN_SKUS: PlanSku[] = [
  {
    sku: "mpm_basic",
    label: "Basic",
    price: 14.99,
    group: "consumer",
    blurb: "$14.99 / month (Access to ONE meal builder only)",
    features: [
      "Macro calculator",
      "Smart Menu Builder (basic)",
      "Biometrics with daily limits",
      "Basic meal presets",
    ],
  },
  {
    sku: "mpm_premium",
    label: "Premium",
    price: 24.99,
    group: "consumer",
    blurb: "Advanced features for serious meal planning",
    features: [
      "All Basic features",
      "Advanced presets & alerts",
      "Shopping list export",
      "Specialty diet menus",
      "Alcohol calculator",
    ],
    badge: "Popular",
  },
  {
    sku: "mpm_ultimate",
    label: "Ultimate",
    price: 34.99,
    group: "consumer",
    blurb: "Complete nutrition toolkit with all features",
    features: [
      "All Premium features",
      "Priority support",
      "Advanced analytics",
      "Custom meal templates",
      "Voice commands",
    ],
  },

  {
    sku: "mpm_family_base",
    label: "Family Base",
    price: 49.99,
    seats: 4,
    group: "family",
    blurb: "One household, 4 profiles, shared menus & shopping",
    features: [
      "Includes up to 4 profiles",
      "Shared Smart Menu Builder",
      "Shared Shopping List",
      "Individual macro tracking per profile",
      "Parental controls",
    ],
    badge: "Best for Families",
  },
  {
    sku: "mpm_family_premium",
    label: "Family Premium",
    price: 99.99,
    seats: 4,
    group: "family",
    blurb: "All 4 seats include Premium features",
    features: [
      "All Family Base features",
      "Premium tier for all 4 profiles",
      "Advanced presets & alerts",
      "Shopping list export",
      "Specialty diet menus",
    ],
    badge: "Best Value",
  },
  {
    sku: "mpm_family_ultimate",
    label: "Family Ultimate",
    price: 159.99,
    seats: 4,
    group: "family",
    blurb: "All 4 seats include Ultimate features",
    features: [
      "All Family Premium features",
      "Ultimate tier for all 4 profiles",
      "Priority family support",
      "Advanced analytics per profile",
      "Voice commands for everyone",
    ],
  },

  {
    sku: "mpm_trainer_5",
    label: "ProCare Trainer 5",
    price: 39.99,
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
    price: 69.99,
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
    price: 99.99,
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
    price: 125.99,
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
