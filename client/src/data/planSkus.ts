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
  | "mpm_partner_chefs_kitchen"
  | "mpm_partner_brand_feature";

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
    sku: "mpm_partner_chefs_kitchen",
    label: "Chef's Kitchen Partnership",
    price: 2500,
    group: "pro",
    hidden: true,
    blurb: "Branded chef presence inside My Perfect Meals — custom kitchen, named recipes, and ongoing placement",
    features: [
      "$2,500 one-time setup (brand build-out, recipes, assets)",
      "$750/month ongoing presence fee",
      "Named 'Chef's Kitchen' section with full branding",
      "Featured recipes attributed to the chef",
      "Optional 10% rev-share on plan upgrades driven by the kitchen",
      "Quarterly analytics report",
    ],
  },
  {
    sku: "mpm_partner_brand_feature",
    label: "Brand Feature Placement",
    price: 1500,
    group: "pro",
    hidden: true,
    blurb: "Featured supplement or beverage product placement inside relevant meals and recipes",
    features: [
      "$1,500/month per product featured",
      "Product appears in relevant meal suggestions and beverage recipes",
      "+$500/month for exclusive category lock (no competing brand)",
      "$5,000 flat — 90-day exclusive feature with analytics report",
      "Approved placement copy and brand assets required",
      "No spam, bots, or misleading claims permitted",
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
