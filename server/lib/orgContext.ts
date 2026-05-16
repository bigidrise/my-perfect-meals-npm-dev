import { db } from "../db";
import { organizations, DEFAULT_ORG_FEATURE_FLAGS } from "../db/schema/organizations";
import type { OrgFeatureFlags } from "../db/schema/organizations";
import { eq } from "drizzle-orm";
import { MPM_PUBLIC_ORG_ID } from "@shared/constants";

export type { OrgFeatureFlags };

export type OrgContext = {
  id: string;
  slug: string;
  name: string;
  activeStatus: string;
  organizationType: string;
  dataAccessMode: string;
  appName: string;
  appShortName: string;
  supportEmail: string;
  supportUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string | null;
  logoUrl: string | null;
  logoDarkUrl: string | null;
  onboardingHeadline: string | null;
  poweredByVisible: boolean;
  customDomain: string | null;
  featureFlags: OrgFeatureFlags;
  isDefault: boolean;
  isWhiteLabel: boolean;
};

const MPM_DEFAULT_ORG: OrgContext = {
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
  featureFlags: { ...DEFAULT_ORG_FEATURE_FLAGS },
  isDefault: true,
  isWhiteLabel: false,
};

// In-process cache — org configs rarely change. TTL = 5 minutes.
const orgCache = new Map<string, { org: OrgContext; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function mapRowToContext(row: typeof organizations.$inferSelect): OrgContext {
  const flags: OrgFeatureFlags = {
    ...DEFAULT_ORG_FEATURE_FLAGS,
    ...(row.featureFlags ?? {}),
  };
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    activeStatus: row.activeStatus,
    organizationType: row.organizationType ?? "public",
    dataAccessMode: row.dataAccessMode ?? "standalone",
    appName: row.appName ?? row.name,
    appShortName: row.appShortName ?? row.slug.toUpperCase().slice(0, 6),
    supportEmail: row.supportEmail ?? "support@myperfectmeals.com",
    supportUrl: row.supportUrl ?? null,
    primaryColor: row.primaryColor ?? "#f97316",
    secondaryColor: row.secondaryColor ?? "#ea580c",
    accentColor: row.accentColor ?? null,
    logoUrl: row.logoUrl ?? null,
    logoDarkUrl: row.logoDarkUrl ?? null,
    onboardingHeadline: row.onboardingHeadline ?? null,
    poweredByVisible: row.poweredByVisible,
    customDomain: row.customDomain ?? null,
    featureFlags: flags,
    isDefault: row.id === MPM_PUBLIC_ORG_ID,
    isWhiteLabel: flags.whiteLabelMode && flags.customBranding,
  };
}

export async function loadOrgContext(orgId: string | null | undefined): Promise<OrgContext> {
  const id = orgId ?? MPM_PUBLIC_ORG_ID;

  const cached = orgCache.get(id);
  if (cached && Date.now() < cached.expiresAt) return cached.org;

  try {
    const [row] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, id))
      .limit(1);

    if (row) {
      const org = mapRowToContext(row);
      orgCache.set(id, { org, expiresAt: Date.now() + CACHE_TTL_MS });
      return org;
    }
  } catch (err) {
    console.error("[OrgContext] Failed to load org from DB, using MPM default:", err);
  }

  // Row not found or DB error — return hardcoded MPM default
  return MPM_DEFAULT_ORG;
}

export async function loadOrgBySlug(slug: string): Promise<OrgContext | null> {
  const cacheKey = `slug:${slug}`;
  const cached = orgCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) return cached.org;

  try {
    const [row] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, slug))
      .limit(1);

    if (row) {
      const org = mapRowToContext(row);
      orgCache.set(cacheKey, { org, expiresAt: Date.now() + CACHE_TTL_MS });
      orgCache.set(row.id, { org, expiresAt: Date.now() + CACHE_TTL_MS });
      return org;
    }
  } catch (err) {
    console.error("[OrgContext] Failed to load org by slug:", err);
  }

  return null;
}

export function getDefaultOrgContext(): OrgContext {
  return MPM_DEFAULT_ORG;
}

export function orgHasFlag(org: OrgContext, flag: keyof OrgFeatureFlags): boolean {
  return org.featureFlags[flag] === true;
}
