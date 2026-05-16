import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  boolean,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export type OrgFeatureFlags = {
  whiteLabelMode: boolean;
  customBranding: boolean;
  physicianDashboard: boolean;
  providerMessaging: boolean;
  medicalRecordIntegration: boolean;
  diabeticHub: boolean;
  glp1Support: boolean;
  partnerMarketplace: boolean;
  productRecommendations: boolean;
  oncologySupport: boolean;
  coachTools: boolean;
  biometricTracking: boolean;
};

export const DEFAULT_ORG_FEATURE_FLAGS: OrgFeatureFlags = {
  whiteLabelMode: false,
  customBranding: false,
  physicianDashboard: false,
  providerMessaging: false,
  medicalRecordIntegration: false,
  diabeticHub: true,
  glp1Support: true,
  partnerMarketplace: false,
  productRecommendations: false,
  oncologySupport: false,
  coachTools: true,
  biometricTracking: true,
};

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    slug: varchar("slug", { length: 100 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    activeStatus: text("active_status").notNull().default("active"),

    organizationType: text("organization_type")
      .$type<
        | "public"
        | "healthcare"
        | "fitness"
        | "chef"
        | "supplement"
        | "enterprise"
        | "insurer"
        | "sports"
      >()
      .default("public"),

    dataAccessMode: text("data_access_mode")
      .$type<
        | "standalone"
        | "wellness_only"
        | "structured_clinical"
        | "full_enterprise"
      >()
      .default("standalone"),

    logoUrl: text("logo_url"),
    logoDarkUrl: text("logo_dark_url"),
    primaryColor: varchar("primary_color", { length: 20 }),
    secondaryColor: varchar("secondary_color", { length: 20 }),
    accentColor: varchar("accent_color", { length: 20 }),
    appName: varchar("app_name", { length: 255 }),
    appShortName: varchar("app_short_name", { length: 50 }),
    supportEmail: varchar("support_email", { length: 255 }),
    supportUrl: text("support_url"),
    onboardingHeadline: text("onboarding_headline"),
    poweredByVisible: boolean("powered_by_visible").notNull().default(true),
    customDomain: varchar("custom_domain", { length: 255 }),

    featureFlags: jsonb("feature_flags")
      .$type<OrgFeatureFlags>()
      .notNull()
      .default(sql`'{}'::jsonb`),

    createdAt: timestamp("created_at").notNull().default(sql`now()`),
    updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
  },
  (t) => ({
    slugIdx: uniqueIndex("idx_organizations_slug").on(t.slug),
    statusIdx: index("idx_organizations_status").on(t.activeStatus),
  })
);
