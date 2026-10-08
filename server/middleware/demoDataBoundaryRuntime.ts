import { eq } from "drizzle-orm";
import { users } from "@shared/schema";
import { db } from "../db";
import { findUserByValidAuthToken } from "../services/authTokenService";
import { readDemoRestriction } from "../services/demoProfessionalRepository";
import { createDemoDataBoundary } from "./demoDataBoundary";
import { isDevelopmentFounderDemoAccount } from "../config/developmentFounderPhysicianDemo";
import { developmentFounderDemoStore } from "../services/developmentFounderDemoRepository";
export const demoDataBoundary = createDemoDataBoundary({
  async actor(req) {
    const sessionId = req.session?.userId;
    if (sessionId) {
      // Session identity, not a URL/header-selected subject. Obsolete/missing
      // identities must not fall through as anonymous on legacy data routes.
      const [user] = await db.select({ id: users.id, username: users.username, email: users.email,
        firstName: users.firstName, lastName: users.lastName,
        role: users.role, professionalRole: users.professionalRole, isProCare: users.isProCare,
        planLookupKey: users.planLookupKey, authSecurityVersion: users.authSecurityVersion }).from(users).where(eq(users.id, sessionId)).limit(1);
      if (!user || req.session.authSecurityVersion !== user.authSecurityVersion) {
        throw { code: "AUTH_REAUTHENTICATION_REQUIRED" };
      }
      return user;
    }
    const token = req.headers["x-auth-token"];
    if (typeof token !== "string" || !token) return null;
    const user = await findUserByValidAuthToken(token);
    if (!user) throw { code: "AUTH_REAUTHENTICATION_REQUIRED" };
    return user;
  },
  restriction: readDemoRestriction,
  async developmentProfile(req, actor, grant) {
    if (grant.authority !== "development_founder" || !isDevelopmentFounderDemoAccount(actor.id)) return null;
    const profile = req.method === "GET" ? await developmentFounderDemoStore.profile()
      : await developmentFounderDemoStore.updateProfile(req.body ?? {});
    return {
      id: actor.id, username: actor.username, email: actor.email, role: actor.role,
      professionalRole: actor.professionalRole, isProCare: actor.isProCare, planLookupKey: actor.planLookupKey,
      firstName: profile.firstName ?? actor.firstName ?? "", lastName: profile.lastName ?? actor.lastName ?? "",
      preferredLanguage: profile.preferredLanguage ?? "auto", operatingStatus: "demo_only",
      demoPersona: "physician", demoGrantState: grant.state,
    };
  },
});
