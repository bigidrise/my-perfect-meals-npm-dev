import type { Express, Request, RequestHandler } from "express";
import { and, eq, isNotNull } from "drizzle-orm";
import { users } from "@shared/schema";
import { db } from "../db";
import { businesses, businessMembers } from "../db/schema/business";
import {
  getDefaultOrgContext,
  loadOrgBySlug,
  loadOrgContext,
  type OrgContext,
} from "../lib/orgContext";

type OptionalSession = {
  userId?: unknown;
  authSecurityVersion?: unknown;
  lastActiveAt?: unknown;
  cookie?: { expires?: unknown };
};

export type OrgConfigUser = {
  id: string;
  organizationId: string | null;
  authSecurityVersion: number;
  role: string | null;
  professionalRole: string | null;
};

export type OrgConfigDependencies = {
  findUser: (userId: string) => Promise<OrgConfigUser | null>;
  findBusinessOrganizationIds: (userId: string) => Promise<string[]>;
  loadOrgContext: (organizationId: string | null) => Promise<OrgContext>;
  loadOrgBySlug: (slug: string) => Promise<OrgContext | null>;
  getDefaultOrgContext: () => OrgContext;
  now: () => number;
};

const CLINICAL_ROLES = new Set([
  "physician",
  "trainer",
  "dietitian",
  "nurse_practitioner",
]);

function sessionIsCurrent(
  session: OptionalSession,
  user: OrgConfigUser,
  now: number,
): boolean {
  if (
    typeof session.authSecurityVersion !== "number" ||
    session.authSecurityVersion !== user.authSecurityVersion
  ) {
    return false;
  }

  const expires = session.cookie?.expires;
  if (expires) {
    const expiresAt = new Date(expires as string | number | Date).getTime();
    if (!Number.isFinite(expiresAt) || expiresAt <= now) return false;
  }

  if (typeof session.lastActiveAt === "number") {
    const isClinical =
      user.role === "admin" ||
      user.role === "coach" ||
      (user.professionalRole !== null && CLINICAL_ROLES.has(user.professionalRole));
    const idleLimit = isClinical ? 15 * 60_000 : 60 * 60_000;
    if (now - session.lastActiveAt > idleLimit) return false;
  }

  return true;
}

const defaultDependencies: OrgConfigDependencies = {
  async findUser(userId) {
    const [user] = await db
      .select({
        id: users.id,
        organizationId: users.organizationId,
        authSecurityVersion: users.authSecurityVersion,
        role: users.role,
        professionalRole: users.professionalRole,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return user ?? null;
  },

  async findBusinessOrganizationIds(userId) {
    const memberships = await db
      .select({ organizationId: businesses.organizationId })
      .from(businessMembers)
      .innerJoin(businesses, eq(businesses.id, businessMembers.businessId))
      .where(
        and(
          eq(businessMembers.userId, userId),
          eq(businessMembers.status, "active"),
          isNotNull(businesses.organizationId),
        ),
      );
    return memberships.flatMap((membership) =>
      membership.organizationId ? [membership.organizationId] : [],
    );
  },

  loadOrgContext,
  loadOrgBySlug,
  getDefaultOrgContext,
  now: Date.now,
};

function disableReusableResponseCaching(req: Request): void {
  delete req.headers["if-none-match"];
  delete req.headers["if-modified-since"];
}

export function createOrgConfigHandler(
  dependencies: OrgConfigDependencies = defaultDependencies,
): RequestHandler {
  return async (req, res) => {
    disableReusableResponseCaching(req);
    res.set({
      "Cache-Control": "private, no-store, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
      Vary: "Cookie, X-Auth-Token, X-Org-Slug",
    });

    const sendDefault = () => res.status(200).json(dependencies.getDefaultOrgContext());

    try {
      if ((req as any).orgContext) {
        return res.status(200).json((req as any).orgContext);
      }

      const session = ((req as any).session ?? {}) as OptionalSession;
      const sessionUserId =
        typeof session.userId === "string" && session.userId.trim()
          ? session.userId
          : null;

      if (sessionUserId) {
        let user: OrgConfigUser | null = null;
        try {
          user = await dependencies.findUser(sessionUserId);
        } catch (error) {
          console.error("[org/config] Optional session lookup failed:", error);
        }

        if (user && sessionIsCurrent(session, user, dependencies.now())) {
          let directOrg: OrgContext | null = null;
          if (user.organizationId) {
            directOrg = await dependencies.loadOrgContext(user.organizationId);
            if (!directOrg.featureFlags.partnerMarketplace) {
              return res.status(200).json(directOrg);
            }
          }

          try {
            const organizationIds =
              await dependencies.findBusinessOrganizationIds(sessionUserId);
            const businessOrgs: OrgContext[] = [];
            for (const organizationId of organizationIds) {
              const businessOrg =
                await dependencies.loadOrgContext(organizationId);
              if (!businessOrg.featureFlags.partnerMarketplace) {
                return res.status(200).json(businessOrg);
              }
              businessOrgs.push(businessOrg);
            }
            if (businessOrgs.length > 0) {
              return res.status(200).json(businessOrgs[0]);
            }
          } catch (error) {
            console.error("[org/config] Business membership lookup failed:", error);
          }

          if (directOrg) return res.status(200).json(directOrg);
        }
      }

      const rawSlug = req.headers["x-org-slug"];
      const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;
      if (typeof slug === "string" && slug.trim()) {
        const publicOrg = await dependencies.loadOrgBySlug(slug.trim());
        if (publicOrg) return res.status(200).json(publicOrg);
      }

      return sendDefault();
    } catch (error) {
      console.error("[org/config] Error:", error);
      return sendDefault();
    }
  };
}

export function registerOrgConfigRoute(app: Express): void {
  app.get("/api/org/config", createOrgConfigHandler());
}