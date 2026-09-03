/**
 * ProCare Invite Service — canonical resolution layer for all ProCare invitation types.
 *
 * Both careInvite (trainer/physician → client, sent via email) and studioInvites
 * (studio owner → client, created manually) resolve through this service so the
 * acceptance contract is identical regardless of the invitation source.
 *
 * The preferred flow is token-based (url_token in the email link).
 * The fallback is the short human code (MP-XXXX-XXX) already in the More tab.
 */

import { db } from "../db";
import { careInvite } from "../db/schema/careTeam";
import { studioInvites, studios } from "../db/schema/studio";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { activateProCareClient, ActivationError } from "./procareActivation";
import { checkLegalAcceptance } from "./legalCheck";
import { evaluateConsumerProCareAccess } from "@shared/procareConsumerAccess";
import { providerHasProCareStudioAccess } from "./procareProviderAccess";
import { resolveEmailIdentityForUser } from "./emailIdentityService";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface InviteResolution {
  source: "care_invite" | "studio_invite";
  inviteId: string;
  invitedEmail: string;
  proUserId: string;
  studioId: string | null;
  studioName: string;
  proName: string;
  studioType: "studio" | "clinic";
  providerRole: string | null;
  expiresAt: Date;
  alreadyAccepted: boolean;
  inviteCode: string;
  urlToken: string;
}

export interface InviteMetadata {
  studioName: string;
  proName: string;
  invitedEmail: string;
  maskedEmail: string;
  studioType: "studio" | "clinic";
  expired: boolean;
  alreadyAccepted: boolean;
}

export interface AcceptResult {
  membershipId: string;
  studioName: string;
}

export type AcceptError =
  | { code: "NOT_FOUND" }
  | { code: "EXPIRED" }
  | { code: "ALREADY_ACCEPTED" }
  | { code: "EMAIL_MISMATCH"; maskedEmail: string }
  | { code: "EMAIL_IDENTITY_REVIEW_REQUIRED" }
  | { code: "PRO_REQUIRED" }
  | { code: "CLINICAL_REQUIRED" }
  | { code: "UNSUPPORTED_PROVIDER_ROLE" }
  | { code: "COACH_NOT_SUBSCRIBED" }
  | { code: "LEGAL_REQUIRED"; missing: string[]; flow: string }
  | { code: "ALREADY_HAS_PROFESSIONAL" }
  | { code: "SELF_ACTIVATION" }
  | { code: "SERVER_ERROR"; message: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

function maskEmail(email: string): string {
  const atIdx = email.indexOf("@");
  // Malformed or no domain — never expose the raw value.
  if (atIdx <= 0) return "****@****";
  const local  = email.slice(0, atIdx);
  const domain = email.slice(atIdx + 1);
  // Short local part (≤ 2 chars) — hide it entirely rather than revealing it.
  if (local.length <= 2) return `****@${domain}`;
  const stars = Math.min(local.length - 2, 4);
  return `${local[0]}${"*".repeat(stars)}${local[local.length - 1]}@${domain}`;
}

async function buildProName(proUserId: string): Promise<string> {
  const [pro] = await db
    .select({ firstName: users.firstName, lastName: users.lastName, email: users.email })
    .from(users)
    .where(eq(users.id, proUserId));
  if (!pro) return "Your trainer";
  return [pro.firstName, pro.lastName].filter(Boolean).join(" ") || pro.email || "Your trainer";
}

// ── Core resolution ───────────────────────────────────────────────────────────

export async function resolveInviteByToken(urlToken: string): Promise<InviteResolution | null> {
  // Try careInvite first — this is what the email system currently uses
  const [careRow] = await db
    .select()
    .from(careInvite)
    .where(eq(careInvite.urlToken, urlToken));

  if (careRow) {
    const proName = await buildProName(careRow.userId);

    const [pro] = await db
      .select({ professionalRole: users.professionalRole })
      .from(users)
      .where(eq(users.id, careRow.userId));
    const studioType: "studio" | "clinic" =
      pro?.professionalRole === "physician" ? "clinic" : "studio";

    const [studio] = await db
      .select()
      .from(studios)
      .where(eq(studios.ownerUserId, careRow.userId));

    return {
      source: "care_invite",
      inviteId: careRow.id,
      invitedEmail: careRow.email,
      proUserId: careRow.userId,
      studioId: studio?.id ?? null,
      studioName: studio?.name ?? `${proName}'s ${studioType === "clinic" ? "Clinic" : "Studio"}`,
      proName,
      studioType,
      providerRole: pro?.professionalRole ?? null,
      expiresAt: careRow.expiresAt,
      alreadyAccepted: careRow.accepted,
      inviteCode: careRow.inviteCode,
      urlToken,
    };
  }

  // Try studioInvites
  const [studioRow] = await db
    .select()
    .from(studioInvites)
    .where(eq(studioInvites.urlToken, urlToken));

  if (studioRow) {
    const [studio] = await db.select().from(studios).where(eq(studios.id, studioRow.studioId));
    if (!studio) return null;
    const [provider] = await db
      .select({ professionalRole: users.professionalRole })
      .from(users)
      .where(eq(users.id, studio.ownerUserId));

    const proName = await buildProName(studio.ownerUserId);
    const studioType: "studio" | "clinic" = studio.type === "clinic" ? "clinic" : "studio";

    return {
      source: "studio_invite",
      inviteId: studioRow.id,
      invitedEmail: studioRow.email,
      proUserId: studio.ownerUserId,
      studioId: studio.id,
      studioName: studio.name,
      proName,
      studioType,
      providerRole: provider?.professionalRole ?? null,
      expiresAt: studioRow.expiresAt,
      alreadyAccepted: !!studioRow.acceptedAt,
      inviteCode: studioRow.inviteCode,
      urlToken,
    };
  }

  return null;
}

// ── Public metadata (safe for unauthenticated callers) ────────────────────────

export async function getInviteMetadata(urlToken: string): Promise<InviteMetadata | null> {
  const r = await resolveInviteByToken(urlToken);
  if (!r) return null;
  return {
    studioName: r.studioName,
    proName: r.proName,
    invitedEmail: r.invitedEmail,
    maskedEmail: maskEmail(r.invitedEmail),
    studioType: r.studioType,
    expired: new Date() > r.expiresAt,
    alreadyAccepted: r.alreadyAccepted,
  };
}

// ── Acceptance ────────────────────────────────────────────────────────────────

export async function acceptInviteByToken(
  urlToken: string,
  userId: string,
  planLookupKey: string | null,
  accessTier: string,
  isInternalAccount = false,
): Promise<{ ok: true; result: AcceptResult } | { ok: false; error: AcceptError }> {
  const r = await resolveInviteByToken(urlToken);
  if (!r) return { ok: false, error: { code: "NOT_FOUND" } };

  if (new Date() > r.expiresAt) return { ok: false, error: { code: "EXPIRED" } };
  if (r.alreadyAccepted) return { ok: false, error: { code: "ALREADY_ACCEPTED" } };

  // Email binding — fetch current user's email from DB (source of truth)
  const [currentUser] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, userId));
  const userEmail = currentUser?.email ?? "";
  const identity = await resolveEmailIdentityForUser(userId);
  if (identity.candidates.length > 1) {
    return { ok: false, error: { code: "EMAIL_IDENTITY_REVIEW_REQUIRED" } };
  }
  const normalizedInvited = r.invitedEmail.trim().toLowerCase();
  const normalizedUser = userEmail.trim().toLowerCase();
  if (normalizedInvited !== normalizedUser) {
    return {
      ok: false,
      error: { code: "EMAIL_MISMATCH", maskedEmail: maskEmail(r.invitedEmail) },
    };
  }

  // Consumer subscription gate is role-aware and shared with code acceptance.
  const eligibility = evaluateConsumerProCareAccess({
    accessTier,
    planLookupKey,
    providerRole: r.providerRole,
    isInternalAccount,
  });
  if (!eligibility.allowed && "code" in eligibility) {
    return { ok: false, error: { code: eligibility.code } };
  }

  // Pro subscription gate
  const [pro] = await db
    .select({
      id: users.id,
      planLookupKey: users.planLookupKey,
      personalPlanLookupKey: users.personalPlanLookupKey,
      isFounder: users.isFounder,
      isSandbox: users.isSandbox,
      isTester: users.isTester,
      trialEndsAt: users.trialEndsAt,
    })
    .from(users)
    .where(eq(users.id, r.proUserId));
  if (!pro || !(await providerHasProCareStudioAccess(pro))) {
    return { ok: false, error: { code: "COACH_NOT_SUBSCRIBED" } };
  }

  // Legal gate
  const legalFlow = r.studioType === "clinic" ? "patient_physician" : "client";
  const legalCheck = await checkLegalAcceptance(userId, legalFlow);
  if (!legalCheck.allAccepted) {
    return {
      ok: false,
      error: { code: "LEGAL_REQUIRED", missing: legalCheck.missing, flow: legalFlow },
    };
  }

  // Activate the ProCare relationship
  let activation: Awaited<ReturnType<typeof activateProCareClient>>;
  try {
    activation = await activateProCareClient(userId, r.proUserId, "studio_token_invite");
  } catch (err) {
    if (err instanceof ActivationError) {
      if (err.code === "CLIENT_ALREADY_HAS_ACTIVE_PROFESSIONAL") {
        return { ok: false, error: { code: "ALREADY_HAS_PROFESSIONAL" } };
      }
      if (err.code === "SELF_ACTIVATION") {
        return { ok: false, error: { code: "SELF_ACTIVATION" } };
      }
    }
    return { ok: false, error: { code: "SERVER_ERROR", message: String(err) } };
  }

  // Mark invite as accepted (non-fatal if this fails — activation already succeeded)
  try {
    if (r.source === "care_invite") {
      await db
        .update(careInvite)
        .set({ accepted: true })
        .where(eq(careInvite.id, r.inviteId));
    } else {
      await db
        .update(studioInvites)
        .set({ acceptedAt: new Date() })
        .where(eq(studioInvites.id, r.inviteId));
    }
  } catch (err) {
    console.error("⚠️ [ProCareInviteService] Failed to mark invite accepted (activation succeeded):", err);
  }

  return {
    ok: true,
    result: {
      membershipId: activation.membershipId,
      studioName: (activation as any).studioName ?? r.studioName,
    },
  };
}
