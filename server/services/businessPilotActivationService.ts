import { createHash, randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { createBusinessPilotAuthorization } from "./businessPilotAuthorizationService";
import {
  businessPilotActivationEnabled, BusinessPilotActivationError,
  clinicalPilotWindow, requirePilotClaim, FOUNDER_ACTIVATION_WORKFLOW,
  finitePilotTimestamp, validateClinicalPilotWindow,
} from "./businessPilotActivationPolicy";

const rows = (result: any): any[] => result.rows ?? result;
const digest = (token: string) => createHash("sha256").update(token).digest("hex");
function enabled() {
  if (!businessPilotActivationEnabled()) {
    throw new BusinessPilotActivationError("Business Pilot activation awaits release approval.", "PILOT_NOT_RELEASED", 503);
  }
}
function validToken(token: unknown): token is string {
  return typeof token === "string" && /^[a-f0-9]{64}$/.test(token);
}

export async function issueBusinessPilotLink(email: string, issuerId: string) {
  enabled();
  const token = randomBytes(32).toString("hex");
  const invitationExpiresAt = finitePilotTimestamp(new Date(Date.now() + 14 * 86400000));
  const authorization = await db.transaction(async (tx) => {
    const created = await createBusinessPilotAuthorization({
      authorizedEmail: email, createdByUserId: issuerId,
      durationPolicy: "fixed", durationDays: 30,
      internalMetadata: { workflow: FOUNDER_ACTIVATION_WORKFLOW },
    }, tx);
    await tx.execute(sql`INSERT INTO business_pilot_activation_links
      (authorization_id, token_hash, invitation_expires_at)
      VALUES (${created.id}, ${digest(token)}, ${invitationExpiresAt})`);
    return created;
  });
  return {
    authorizationId: authorization.id, invitationExpiresAt,
    activationPath: `/activate/business-pilot#token=${token}`,
  };
}

export async function inspectBusinessPilotLink(token: unknown) {
  enabled();
  if (!validToken(token)) throw new BusinessPilotActivationError("Invitation not found.", "PILOT_NOT_FOUND", 404);
  const [row] = rows(await db.execute(sql`SELECT a.status, l.invitation_expires_at,
    l.activated_user_id, l.personal_access_started_at, l.personal_access_ends_at
    FROM business_pilot_activation_links l
    JOIN business_pilot_authorizations a ON a.id = l.authorization_id
    WHERE l.token_hash = ${digest(token)}`));
  if (!row) throw new BusinessPilotActivationError("Invitation not found.", "PILOT_NOT_FOUND", 404);
  const invitationExpiresAt = finitePilotTimestamp(row.invitation_expires_at);
  if (row.activated_user_id) validateClinicalPilotWindow(row.personal_access_started_at, row.personal_access_ends_at);
  return {
    available: row.status !== "revoked" && !row.activated_user_id
      && invitationExpiresAt > new Date(),
    activated: Boolean(row.activated_user_id),
    endsAt: row.personal_access_ends_at,
    durationDays: 30,
  };
}

export async function activateBusinessPilotLink(token: unknown, userId: string) {
  enabled();
  if (!validToken(token)) throw new BusinessPilotActivationError("Invitation not found.", "PILOT_NOT_FOUND", 404);
  return db.transaction(async (tx) => {
    const [row] = rows(await tx.execute(sql`SELECT l.*, a.normalized_authorized_email,
      a.status, a.claimed_user_id FROM business_pilot_activation_links l
      JOIN business_pilot_authorizations a ON a.id = l.authorization_id
      WHERE l.token_hash = ${digest(token)} FOR UPDATE OF l, a`));
    if (!row) throw new BusinessPilotActivationError("Invitation not found.", "PILOT_NOT_FOUND", 404);
    const [account] = rows(await tx.execute(sql`SELECT email FROM users WHERE id = ${userId}`));
    if (!account) throw new BusinessPilotActivationError("Authentication required.", "AUTH_REQUIRED", 401);
    const now = new Date();
    requirePilotClaim({
      authorizedEmail: row.normalized_authorized_email, accountEmail: account.email,
      revoked: row.status === "revoked" || row.status === "expired",
      invitationExpiresAt: new Date(row.invitation_expires_at),
      activatedUserId: row.activated_user_id ?? row.claimed_user_id, userId,
    }, now);
    if (row.activated_user_id) {
      const originalWindow = validateClinicalPilotWindow(row.personal_access_started_at, row.personal_access_ends_at);
      return { authorizationId: row.authorization_id, ...originalWindow, alreadyActivated: true };
    }
    if (row.personal_access_started_at != null || row.personal_access_ends_at != null) {
      throw new BusinessPilotActivationError("Pilot activation state could not be verified.", "PILOT_WINDOW_INVALID", 503);
    }
    // A legacy signup binding alone is not activation and never bypasses the invitation deadline.
    if (new Date(row.invitation_expires_at) <= now) {
      throw new BusinessPilotActivationError("Invitation expired.", "PILOT_INVITATION_EXPIRED", 410);
    }
    const window = clinicalPilotWindow(now);
    await tx.execute(sql`UPDATE business_pilot_activation_links SET
      activated_user_id = ${userId}, personal_access_started_at = ${window.startedAt},
      personal_access_ends_at = ${window.endsAt} WHERE authorization_id = ${row.authorization_id}`);
    await tx.execute(sql`UPDATE business_pilot_authorizations SET
      claimed_user_id = ${userId}, claimed_at = COALESCE(claimed_at, ${now}),
      status = 'active', starts_at = ${window.startedAt}, expires_at = ${window.endsAt},
      updated_at = ${now} WHERE id = ${row.authorization_id}`);
    return { authorizationId: row.authorization_id, ...window, alreadyActivated: false };
  });
}

export async function getBusinessPilotActivation(userId: string, executor: any = db, lock = false) {
  if (!businessPilotActivationEnabled()) return null;
  const [row] = rows(await executor.execute(sql`SELECT l.*, a.status
    FROM business_pilot_activation_links l
    JOIN business_pilot_authorizations a ON a.id = l.authorization_id
    WHERE l.activated_user_id = ${userId}
    ORDER BY l.personal_access_started_at DESC LIMIT 1
    ${lock ? sql`FOR UPDATE OF l, a` : sql``}`));
  if (row) validateClinicalPilotWindow(row.personal_access_started_at, row.personal_access_ends_at);
  return row ?? null;
}

export async function getActiveBusinessPilotClinicalAccess(userId: string) {
  const row = await getBusinessPilotActivation(userId);
  if (!row || !["active", "converted"].includes(row.status) ||
      new Date(row.personal_access_started_at) > new Date() ||
      new Date(row.personal_access_ends_at) <= new Date()) return null;
  return { authorizationId: row.authorization_id, endsAt: row.personal_access_ends_at };
}

export async function founderOrganizationWindow(tx: any, userId: string) {
  const grant = await getBusinessPilotActivation(userId, tx, true);
  if (!grant) {
    // Signup prebinding is not token activation. Legacy universal onboarding
    // must not accidentally start/attach this explicitly reserved founder pilot.
    const [reserved] = rows(await tx.execute(sql`SELECT id FROM business_pilot_authorizations
      WHERE claimed_user_id = ${userId} AND status IN ('pending', 'active')
        AND internal_metadata->>'workflow' = ${FOUNDER_ACTIVATION_WORKFLOW}
      LIMIT 1`));
    if (reserved) throw new BusinessPilotActivationError(
      "Activate your founder invitation before creating its Organization. If activation is paused, wait for release approval.",
      "FOUNDER_ACTIVATION_REQUIRED",
    );
    return null;
  }
  if (grant.business_id || grant.organization_consumed) throw new BusinessPilotActivationError(
    "This invitation already funded an Organization and cannot fund another. Your personal pilot keeps its original expiration.",
    "PILOT_ORGANIZATION_ALREADY_ATTACHED",
  );
  // Expired/revoked grants never fall back to a newly gifted 30-day window.
  return {
    startedAt: new Date(grant.personal_access_started_at),
    endsAt: grant.status === "revoked"
      ? new Date(Math.min(Date.now(), new Date(grant.personal_access_ends_at).getTime()))
      : new Date(grant.personal_access_ends_at),
    authorizationId: grant.authorization_id,
  };
}

export async function bindFounderOrganization(tx: any, authorizationId: string, businessId: string) {
  const result = await tx.execute(sql`UPDATE business_pilot_activation_links
    SET business_id = ${businessId}, organization_consumed = true
    WHERE authorization_id = ${authorizationId} AND business_id IS NULL
      AND organization_consumed = false AND activated_user_id IS NOT NULL
    RETURNING authorization_id`);
  if (!rows(result).length) throw new BusinessPilotActivationError(
    "This invitation's Organization reservation could not be verified.", "PILOT_ORGANIZATION_ALREADY_ATTACHED",
  );
}
