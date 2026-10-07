import { and, eq, or, sql } from "drizzle-orm";
import { db } from "../db";
import { users } from "@shared/schema";
import { careInvite, careTeamMember } from "../db/schema/careTeam";
import { studios, studioInvites, studioMemberships } from "../db/schema/studio";
import { clientLinks } from "../db/schema/procare";
import { demoProfessionalGrants, demoProfessionalPatients } from "../db/schema/demoProfessional";
import { buildAuthUserWithEffectiveAccess } from "../middleware/requireAuth";
import { evaluateConsumerProCareAccess } from "@shared/procareConsumerAccess";
import { checkLegalAcceptance } from "./legalCheck";
import { ensureProviderStudioReady } from "./procareStudioReadiness";
import { activateProCareClient, ActivationError, type ProCareAttribution } from "./procareActivation";
import { normalizeEmailIdentity, resolveEmailIdentityForUser } from "./emailIdentityService";
import { resolveProviderStudioAttribution, validateBp1Attribution, type Bp1Attribution } from "./bp1OrganizationAttributionService";
import { discoverAuthorizedWorkspaces } from "./organizationWorkspaceService";
import { CareInvitationError, assertInvitationWindow, resolveCareInvitationParties } from "./careInvitationPolicy";

export type InvitationSource = "care_invite" | "studio_invite";
export interface StoredCareInvitation {
  source: InvitationSource;
  row: any;
}
export async function findCareInvitation(kind: "code" | "token", value: string): Promise<StoredCareInvitation | null> {
  const key = value.trim();
  if (!key || key.length > 128) return null;
  const [care] = await db.select().from(careInvite)
    .where(eq(kind === "code" ? careInvite.inviteCode : careInvite.urlToken, key)).limit(1);
  if (care) return { source: "care_invite", row: care };
  const [studio] = await db.select().from(studioInvites)
    .where(eq(kind === "code" ? studioInvites.inviteCode : studioInvites.urlToken, key)).limit(1);
  return studio ? { source: "studio_invite", row: studio } : null;
}

/** Standalone Studios remain legitimate; an explicit Organization selection never falls back. */
export async function resolveInvitationAttribution(providerId: string, studio: typeof studios.$inferSelect,
  selected: { organizationId: string; locationId: string } | null = null): Promise<Bp1Attribution | null> {
  if (!studio.orgId && !selected && !(await discoverAuthorizedWorkspaces(providerId)).length) return null;
  return resolveProviderStudioAttribution(providerId, studio, selected);
}

export async function assertLiveParties(providerId: string, clientId: string) {
  const [restriction] = await db.select({ id: demoProfessionalGrants.id }).from(demoProfessionalGrants)
    .where(or(eq(demoProfessionalGrants.userId, providerId), eq(demoProfessionalGrants.userId, clientId))).limit(1);
  const [synthetic] = await db.select({ id: demoProfessionalPatients.id }).from(demoProfessionalPatients)
    .where(sql`${demoProfessionalPatients.id}::text = ${providerId} OR ${demoProfessionalPatients.id}::text = ${clientId}`).limit(1);
  if (restriction || synthetic) throw new CareInvitationError("INVITATION_DATASET_MISMATCH");
}
function attributionOf(row: any): Bp1Attribution | null {
  const fields = ["organizationId", "locationId", "sourceBusinessId", "partnerRecordId"] as const;
  if (!fields.some(field => row[field] != null)) return null;
  if (!row.organizationId || !row.locationId) throw new CareInvitationError("ATTRIBUTION_INVALID", 409);
  return { organizationId: row.organizationId, locationId: row.locationId,
    sourceBusinessId: row.sourceBusinessId ?? null, partnerRecordId: row.partnerRecordId ?? null };
}
function sameScope(record: any, scope: ProCareAttribution | null) {
  return ["organizationId", "locationId", "sourceBusinessId", "partnerRecordId"]
    .every(key => (record[key] ?? null) === ((scope as any)?.[key] ?? null));
}
const accepted = (invite: StoredCareInvitation) =>
  invite.source === "care_invite" ? invite.row.accepted : !!invite.row.acceptedAt;

export async function acceptStoredCareInvitation(invite: StoredCareInvitation, actorId: string) {
  const row = invite.row;
  // Identity/email binding precedes ALL provisioning and relationship writes.
  const identity = await resolveEmailIdentityForUser(actorId);
  if (identity.candidates.length > 1) throw new CareInvitationError("EMAIL_IDENTITY_REVIEW_REQUIRED", 409);
  if (!("user" in identity) || identity.status !== "unique" || normalizeEmailIdentity(identity.user.email) !== normalizeEmailIdentity(row.email)) {
    throw new CareInvitationError("EMAIL_MISMATCH", 403, "Sign in with the account that received this invitation.");
  }
  assertInvitationWindow(row);
  if (accepted(invite) && row.acceptedByUserId !== actorId) throw new CareInvitationError("ALREADY_ACCEPTED", 409);
  const [recipient] = await db.select().from(users).where(eq(users.id, actorId)).limit(1);
  let creatorId = row.userId;
  let invitedStudio: typeof studios.$inferSelect | undefined;
  if (invite.source === "studio_invite") {
    [invitedStudio] = await db.select().from(studios).where(eq(studios.id, row.studioId)).limit(1);
    if (!invitedStudio || invitedStudio.status !== "active") throw new CareInvitationError("STUDIO_NOT_FOUND", 404);
    creatorId = invitedStudio.ownerUserId;
  }
  const [creator] = await db.select().from(users).where(eq(users.id, creatorId)).limit(1);
  if (!creator || !recipient) throw new CareInvitationError("INVITATION_PARTY_NOT_FOUND", 404);
  const { provider, client } = resolveCareInvitationParties(creator, recipient, row);
  // Studio ownership selects a workspace, never grants its owner a practitioner identity.
  if (invitedStudio && invitedStudio.ownerUserId !== provider.id) throw new CareInvitationError("STUDIO_PROVIDER_MISMATCH", 409);
  await assertLiveParties(provider.id, client.id);
  const clientAccount = client.id === recipient.id ? recipient : creator;
  const clientAccess = await buildAuthUserWithEffectiveAccess(clientAccount);
  const eligibility = evaluateConsumerProCareAccess({
    accessTier: clientAccess.accessTier, planLookupKey: clientAccess.planLookupKey,
    providerRole: provider.professionalRole,
    isInternalAccount: clientAccess.isFounder || clientAccess.isSandbox || clientAccess.isTester,
  });
  if (!eligibility.allowed && "code" in eligibility) {
    throw new CareInvitationError(eligibility.code, 403, eligibility.message, { requiredTier: eligibility.requiredTier });
  }
  const legalFlow = provider.professionalRole === "physician" ? "patient_physician" : "client";
  const legal = await checkLegalAcceptance(client.id, legalFlow);
  if (!legal.allAccepted) throw new CareInvitationError("LEGAL_REACCEPT_REQUIRED", 409,
    "The client must accept the current relationship agreements.", {
      flow: legalFlow, missing: legal.missing, legalForCurrentUser: client.id === actorId,
    });
  const ready = await ensureProviderStudioReady(provider.id);
  if (!ready.ok) throw new CareInvitationError(ready.code ?? "PROVIDER_NOT_READY", 403, ready.message,
    { flow: ready.flow, missing: ready.missing });
  const [studio] = await db.select().from(studios).where(eq(studios.ownerUserId, provider.id)).limit(1);
  if (!studio || studio.status !== "active" || (invitedStudio && invitedStudio.id !== studio.id) ||
      studio.type !== (provider.professionalRole === "physician" ? "clinic" : "studio")) {
    throw new CareInvitationError("STUDIO_PROVIDER_MISMATCH", 409);
  }
  const scope = attributionOf(row);
  if (studio.orgId && studio.orgId !== scope?.organizationId) throw new CareInvitationError("ATTRIBUTION_INVALID", 409);
  if (scope) {
    await validateBp1Attribution(scope);
    const current = await resolveInvitationAttribution(provider.id, studio, scope);
    if (!current || !sameScope(current, scope)) throw new CareInvitationError("ATTRIBUTION_INVALID", 409);
  }

  const memberQuery = (executor: any) => executor.select().from(careTeamMember).where(and(
    eq(careTeamMember.userId, client.id), eq(careTeamMember.proUserId, provider.id))).limit(1);
  // A used invite is a receipt, not permission to restore a later-revoked relationship.
  if (accepted(invite)) {
    if (row.acceptedByUserId !== actorId) throw new CareInvitationError("ALREADY_ACCEPTED", 409);
    const [membership] = await db.select().from(studioMemberships).where(and(
      eq(studioMemberships.clientUserId, client.id), eq(studioMemberships.studioId, studio.id),
      eq(studioMemberships.status, "active"), eq(studioMemberships.isArchived, false))).limit(1);
    const [link] = await db.select().from(clientLinks).where(and(eq(clientLinks.clientUserId, client.id),
      eq(clientLinks.proUserId, provider.id), eq(clientLinks.active, true))).limit(1);
    const [member] = await memberQuery(db);
    if (!membership || !link || !member || member.status !== "active" ||
        !sameScope(membership, scope) || !sameScope(link, scope) || !sameScope(member, scope)) {
      throw new CareInvitationError("ALREADY_ACCEPTED", 409);
    }
    return { member, studioId: studio.id, studioName: studio.name, studioType: studio.type,
      membershipId: membership.id, ownerUserId: provider.id, alreadyActive: true };
  }

  let member: typeof careTeamMember.$inferSelect;
  const table = invite.source === "care_invite" ? careInvite : studioInvites;
  try {
    const activation = await activateProCareClient(client.id, provider.id, `invitation_${invite.source}`,
      async (tx, activation) => {
        const [locked] = await tx.select().from(table).where(eq(table.id, row.id)).for("update");
        if (!locked) throw new CareInvitationError("NOT_FOUND", 404);
        assertInvitationWindow(locked);
        if (normalizeEmailIdentity(locked.email) !== normalizeEmailIdentity(row.email) ||
            !sameScope(locked, scope) ||
            (locked.providerUserId && locked.providerUserId !== provider.id) ||
            (locked.clientUserId && locked.clientUserId !== client.id) ||
            (invite.source === "studio_invite" && locked.studioId !== studio.id) ||
            (invite.source === "care_invite" && (locked.userId !== row.userId ||
              (locked.providerUserId && locked.providerUserId !== provider.id) ||
              (locked.clientUserId && locked.clientUserId !== client.id)))) {
          throw new CareInvitationError("INVITATION_CHANGED", 409);
        }
        if (activation.studioId !== studio.id) throw new CareInvitationError("STUDIO_PROVIDER_MISMATCH", 409);
        const [currentStudio] = await tx.select().from(studios).where(eq(studios.id, studio.id)).for("share");
        const [membership] = await tx.select().from(studioMemberships).where(eq(studioMemberships.id, activation.membershipId));
        const [link] = await tx.select().from(clientLinks).where(eq(clientLinks.id, activation.clientLinkId));
        if (!currentStudio || currentStudio.ownerUserId !== provider.id || currentStudio.type !== studio.type ||
            currentStudio.status !== "active" || currentStudio.orgId !== studio.orgId ||
            !membership || !link || !sameScope(membership, scope) || !sameScope(link, scope)) {
          throw new CareInvitationError("ATTRIBUTION_INVALID", 409);
        }
        if ((invite.source === "care_invite" ? locked.accepted : locked.acceptedAt) &&
            (locked.acceptedByUserId !== actorId || !activation.alreadyActive)) throw new CareInvitationError("ALREADY_ACCEPTED", 409);
        const currentAccounts = await tx.select().from(users)
          .where(or(eq(users.id, provider.id), eq(users.id, client.id))).for("share");
        const currentProvider = currentAccounts.find((account: any) => account.id === provider.id);
        const currentClient = currentAccounts.find((account: any) => account.id === client.id);
        if (!currentProvider || !currentClient || currentProvider.professionalRole !== provider.professionalRole ||
            currentProvider.authSecurityVersion !== (provider as any).authSecurityVersion ||
            currentClient.authSecurityVersion !== clientAccount.authSecurityVersion ||
            normalizeEmailIdentity(currentAccounts.find((account: any) => account.id === actorId)?.email) !== normalizeEmailIdentity(row.email)) {
          throw new CareInvitationError("INVITATION_PARTIES_CHANGED", 409);
        }
        const [existing] = await memberQuery(tx);
        if (existing && !sameScope(existing, scope)) throw new CareInvitationError("ATTRIBUTION_INVALID", 409);
        const values = {
          userId: client.id, proUserId: provider.id, role: provider.professionalRole!,
          name: [currentProvider.firstName, currentProvider.lastName].filter(Boolean).join(" ") || currentProvider.email,
          email: currentProvider.email, status: "active",
          permissions: row.permissions ?? { canViewMacros: true, canAddMeals: false, canEditPlan: false },
          updatedAt: new Date(), ...(scope ?? {}),
        };
        [member] = existing
          ? await tx.update(careTeamMember).set(values).where(eq(careTeamMember.id, existing.id)).returning()
          : await tx.insert(careTeamMember).values(values).returning();
        // Remove only this client-created pending placeholder, never another relationship.
        if (invite.source === "care_invite" && client.id === row.userId) {
          await tx.delete(careTeamMember).where(and(eq(careTeamMember.userId, client.id),
            eq(careTeamMember.email, row.email), eq(careTeamMember.status, "pending")));
        }
        await tx.update(table).set(invite.source === "care_invite"
          ? { accepted: true, acceptedByUserId: actorId, providerUserId: provider.id, clientUserId: client.id }
          : { acceptedAt: new Date(), acceptedByUserId: actorId, providerUserId: provider.id, clientUserId: client.id }).where(eq(table.id, row.id));
      }, scope);
    return { ...activation, member: member! };
  } catch (error) {
    if (error instanceof ActivationError) throw new CareInvitationError(error.code, 409, error.message);
    throw error;
  }
}

export function invitationFailure(res: any, error: unknown) {
  if (error instanceof CareInvitationError) return res.status(error.status).json({
    error: error.code, code: error.code, message: error.message, ...error.details });
  const scoped = error as { code?: string; status?: number; message?: string };
  if (scoped.status && scoped.code) return res.status(scoped.status).json({ error: scoped.code, code: scoped.code, message: scoped.message });
  console.error("[CareInvitation] Acceptance failed", error);
  return res.status(500).json({ error: "SERVER_ERROR", message: "Connection could not be completed. Please try again." });
}
