export type LookupKey =
  | "mpm_basic_monthly"
  | "mpm_premium_monthly"
  | "mpm_premium_beta_monthly"
  | "mpm_ultimate_monthly"
  | "mpm_family_base_monthly"
  | "mpm_family_all_premium_monthly"
  | "mpm_family_all_ultimate_monthly"
  | "mpm_procare_monthly";

export type BillingCycle = "monthly";

export type PlanSku = {
  sku: LookupKey;
  label: string;
  price: number;
  seats?: number;
  hidden?: boolean;
  blurb?: string;
  features?: string[];
  group: "consumer" | "family" | "pro";
  badge?: string;
};

export const PLAN_SKUS: PlanSku[] = [
  {
    sku: "mpm_basic_monthly",
    label: "Basic",
    price: 9.99,
    group: "consumer",
    blurb: "$9.99 / month (Access to ONE meal builder only)",
    features: [
      "Macro calculator",
      "Smart Menu Builder (basic)",
      "Biometrics with daily limits",
      "Basic meal presets"
    ]
  },
  {
    sku: "mpm_premium_monthly",
    label: "Premium",
    price: 19.99,
    group: "consumer",
    blurb: "Advanced features for serious meal planning",
    features: [
      "All Basic features",
      "Advanced presets & alerts",
      "Shopping list export",
      "Specialty diet menus",
      "Alcohol calculator"
    ],
    badge: "Popular"
  },
  {
    sku: "mpm_premium_beta_monthly",
    label: "Premium (Beta)",
    price: 9.99,
    group: "consumer",
    hidden: true,
    blurb: "Special beta pricing for early adopters",
    features: [
      "All Premium features",
      "Beta access pricing"
    ]
  },
  {
    sku: "mpm_ultimate_monthly",
    label: "Ultimate",
    price: 29.99,
    group: "consumer",
    blurb: "Complete nutrition toolkit with all features",
    features: [
      "All Premium features",
      "Priority support",
      "Advanced analytics",
      "Custom meal templates",
      "Voice commands"
    ]
  },
  {
    sku: "mpm_family_base_monthly",
    label: "Family Base",
    price: 39.99,
    seats: 4,
    group: "family",
    blurb: "One household, 4 profiles, shared menus & shopping",
    features: [
      "Includes up to 4 profiles",
      "Shared Smart Menu Builder",
      "Shared Shopping List",
      "Individual macro tracking per profile",
      "Parental controls"
    ],
    badge: "Best for Families"
  },
  {
    sku: "mpm_family_all_premium_monthly",
    label: "Family All-Premium",
    price: 49.99,
    seats: 4,
    group: "family",
    blurb: "All 4 seats include Premium features",
    features: [
      "All Family Base features",
      "Premium tier for all 4 profiles",
      "Advanced presets for everyone",
      "Specialty diets per profile",
      "Alcohol tracking per profile"
    ]
  },
  {
    sku: "mpm_family_all_ultimate_monthly",
    label: "Family All-Ultimate",
    price: 79.99,
    seats: 4,
    group: "family",
    blurb: "All 4 seats include Ultimate features",
    features: [
      "All Family All-Premium features",
      "Ultimate tier for all 4 profiles",
      "Priority family support",
      "Advanced analytics per profile",
      "Voice commands for everyone"
    ]
  },
  {
    sku: "mpm_procare_monthly",
    label: "ProCare",
    price: 49.99,
    group: "pro",
    blurb: "Doctors/trainers toolkit with client linking",
    features: [
      "Client management dashboard",
      "Professional meal templates",
      "Client progress tracking",
      "Nutrition coaching tools",
      "Priority professional support"
    ]
  }
];

export function getPlanBySku(sku: LookupKey): PlanSku | undefined {
  return PLAN_SKUS.find(p => p.sku === sku);
}

export function getPublicPlans(): PlanSku[] {
  return PLAN_SKUS.filter(p => !p.hidden);
}

export function getPlansByGroup(group: "consumer" | "family" | "pro"): PlanSku[] {
  return PLAN_SKUS.filter(p => p.group === group && !p.hidden);
}