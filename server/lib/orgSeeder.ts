import { db } from "../db";
import { organizations } from "../db/schema/organizations";
import { MPM_PUBLIC_ORG_ID } from "@shared/constants";
import { eq } from "drizzle-orm";

export async function seedDefaultOrganizations(): Promise<void> {
  try {
    // MPM Public org — stable UUID, always present
    const [existing] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.id, MPM_PUBLIC_ORG_ID))
      .limit(1);

    if (!existing) {
      await db.insert(organizations).values({
        id: MPM_PUBLIC_ORG_ID,
        slug: "mpm-public",
        name: "My Perfect Meals",
        activeStatus: "active",
        organizationType: "public",
        dataAccessMode: "standalone",
        appName: "My Perfect Meals",
        appShortName: "MPM",
        supportEmail: "support@myperfectmeals.com",
        supportUrl: null,
        primaryColor: "#f97316",
        secondaryColor: "#ea580c",
        accentColor: null,
        logoUrl: null,
        logoDarkUrl: null,
        onboardingHeadline: null,
        poweredByVisible: true,
        customDomain: null,
        featureFlags: {
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
        },
      });
      console.log("[OrgSeeder] Inserted MPM public org row.");
    }

    // Divvy Health placeholder — only inserts if not already present
    const [divvyExists] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, "divvy-health"))
      .limit(1);

    if (!divvyExists) {
      await db.insert(organizations).values({
        slug: "divvy-health",
        name: "Divvy Health",
        activeStatus: "active",
        organizationType: "healthcare",
        dataAccessMode: "structured_clinical",
        appName: "Divvy Health",
        appShortName: "Divvy",
        supportEmail: "support@divvyhealth.com",
        supportUrl: "https://help.divvyhealth.com",
        primaryColor: "#0ea5e9",
        secondaryColor: "#0284c7",
        accentColor: "#38bdf8",
        logoUrl: null,
        logoDarkUrl: null,
        onboardingHeadline: "Personalized nutrition, powered by your care team.",
        poweredByVisible: true,
        customDomain: "app.divvyhealth.com",
        featureFlags: {
          whiteLabelMode: true,
          customBranding: true,
          physicianDashboard: true,
          providerMessaging: true,
          medicalRecordIntegration: false,
          diabeticHub: true,
          glp1Support: true,
          partnerMarketplace: false,
          productRecommendations: false,
          oncologySupport: false,
          coachTools: true,
          biometricTracking: true,
        },
      });
      console.log("[OrgSeeder] Inserted Divvy Health placeholder org row.");
    }
  } catch (err) {
    console.error("[OrgSeeder] Failed to seed organizations:", err);
  }
}
