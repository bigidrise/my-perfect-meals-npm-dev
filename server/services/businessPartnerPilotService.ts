import { randomBytes, createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { createBusinessPilotAuthorization } from "./businessPilotAuthorizationService";
import {
  businessPilotActivationEnabled, BusinessPilotActivationError,
  clinicalPilotWindow, validateClinicalPilotWindow, FOUNDER_ACTIVATION_WORKFLOW,
} from "./businessPilotActivationPolicy";

// The already-approved founder issuance is attribution only. Its recipient and
// invitation deadline do not restrict this separately approved reusable campaign.
const FOUNDER_ISSUANCE = "33887548-9271-4d03-aef9-1d5e614d0e49";
const rows = (result: any): any[] => result.rows ?? result;

function requireDevelopmentCampaign() {
  if (process.env.NODE_ENV !== "development" ||
      ["true", "1"].includes(process.env.REPLIT_DEPLOYMENT ?? "") ||
      !businessPilotActivationEnabled()) {
    throw new BusinessPilotActivationError("Partner pilot link is unavailable in this environment.", "PILOT_NOT_RELEASED", 404);
  }
}

async function issuer(executor: any) {
  const [source] = rows(await executor.execute(sql`SELECT created_by_user_id
    FROM business_pilot_authorizations WHERE id = ${FOUNDER_ISSUANCE}
      AND internal_metadata->>'workflow' = ${FOUNDER_ACTIVATION_WORKFLOW}
      AND status <> 'revoked'`));
  if (!source?.created_by_user_id) {
    throw new BusinessPilotActivationError("Partner pilot enrollment is unavailable.", "PILOT_NOT_RELEASED", 503);
  }
  return source.created_by_user_id as string;
}

export async function inspectBusinessPartnerPilot() {
  requireDevelopmentCampaign();
  await issuer(db);
  return { available: true, activated: false, reusable: true, durationDays: 30 };
}

export async function activateBusinessPartnerPilot(userId: string) {
  requireDevelopmentCampaign();
  return db.transaction(async tx => {
    const founderId = await issuer(tx);
    const [account] = rows(await tx.execute(sql`SELECT email FROM users
      WHERE id = ${userId} FOR UPDATE`));
    if (!account) throw new BusinessPilotActivationError("Authentication required.", "AUTH_REQUIRED", 401);
    const email = account.email.trim().toLowerCase();
    // Match the existing authorization lock so simultaneous claims cannot
    // create multiple grants for this identity.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${email}))`);
    const [existing] = rows(await tx.execute(sql`SELECT l.*, a.status, a.claimed_user_id
      FROM business_pilot_activation_links l
      JOIN business_pilot_authorizations a ON a.id = l.authorization_id
      WHERE l.activated_user_id = ${userId}
        OR a.normalized_authorized_email = ${email}
      ORDER BY (l.activated_user_id IS NOT NULL) DESC, a.created_at DESC
      LIMIT 1 FOR UPDATE OF l, a`));
    if (existing) {
      if (existing.status === "revoked" ||
          (existing.activated_user_id && existing.activated_user_id !== userId)) {
        throw new BusinessPilotActivationError("This account cannot start another pilot.", "PILOT_UNAVAILABLE", 403);
      }
      if (existing.activated_user_id) {
        return {
          authorizationId: existing.authorization_id,
          ...validateClinicalPilotWindow(existing.personal_access_started_at, existing.personal_access_ends_at),
          alreadyActivated: true,
        };
      }
      if (existing.claimed_user_id && existing.claimed_user_id !== userId) {
        throw new BusinessPilotActivationError("This account cannot start another pilot.", "PILOT_UNAVAILABLE", 403);
      }
      if (existing.personal_access_started_at != null || existing.personal_access_ends_at != null) {
        throw new BusinessPilotActivationError("Pilot state could not be verified.", "PILOT_WINDOW_INVALID", 503);
      }
    }
    const window = clinicalPilotWindow(new Date());
    const authorizationId = existing?.authorization_id ?? (await createBusinessPilotAuthorization({
      authorizedEmail: account.email, createdByUserId: founderId,
      durationPolicy: "fixed", durationDays: 30,
      internalMetadata: {
        workflow: FOUNDER_ACTIVATION_WORKFLOW,
        enrollmentSource: "reusable_business_partner_link",
        sourceAuthorizationId: FOUNDER_ISSUANCE,
      },
    }, tx)).id;
    if (existing) {
      await tx.execute(sql`UPDATE business_pilot_activation_links SET
        activated_user_id = ${userId}, personal_access_started_at = ${window.startedAt},
        personal_access_ends_at = ${window.endsAt}
        WHERE authorization_id = ${authorizationId}`);
    } else {
      // Every partner receives a distinct persisted grant. The public link
      // is never consumed or used as the hash of a recipient's private grant.
      const privateHash = createHash("sha256").update(randomBytes(32)).digest("hex");
      await tx.execute(sql`INSERT INTO business_pilot_activation_links
        (authorization_id, token_hash, invitation_expires_at, activated_user_id,
          personal_access_started_at, personal_access_ends_at)
        VALUES (${authorizationId}, ${privateHash}, ${window.endsAt}, ${userId},
          ${window.startedAt}, ${window.endsAt})`);
    }
    await tx.execute(sql`UPDATE business_pilot_authorizations SET
      claimed_user_id = ${userId}, claimed_at = COALESCE(claimed_at, ${window.startedAt}),
      status = 'active', starts_at = ${window.startedAt}, expires_at = ${window.endsAt},
      internal_metadata = COALESCE(internal_metadata, '{}'::jsonb) ||
        '{"enrollmentSource":"reusable_business_partner_link"}'::jsonb,
      updated_at = ${window.startedAt} WHERE id = ${authorizationId}`);
    return { authorizationId, ...window, alreadyActivated: false };
  });
}
