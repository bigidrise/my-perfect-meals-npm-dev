import { Router } from "express";
import { db } from "../db";
import { 
  studios, studioBilling, studioMemberships, studioInvites, 
  clientNotes, clientActivityLog
} from "../db/schema/studio";
import { users } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { logClientActivity, logClientActivityForStudioMember } from "../services/activityLog";
import { sendCareTeamInvite } from "../services/emailService";
import { pushToUser } from "../services/pushNotify";
import { activateProCareClient, deactivateProCareClient, ActivationError } from "../services/procareActivation";
import { assignBuilder, isValidBuilder, VALID_BUILDERS } from "../services/builderAssignment";
import { checkLegalAcceptance } from "../services/legalCheck";
import { AuthenticatedRequest } from "../middleware/requireAuth";
import { assertSameOrg, handleOrgIsolationError } from "../lib/orgIsolation";
import { logAudit, getClientIp } from "../lib/auditLog";
import {
  findEmailIdentityCandidates,
  normalizeEmailIdentity,
  resolveEmailIdentityForUser,
} from "../services/emailIdentityService";

const router = Router();

async function getUserId(req: any): Promise<string | null> {
  const authUser = (req as AuthenticatedRequest).authUser;
  if (authUser?.id) return authUser.id;
  if (req.session?.userId) return req.session.userId as string;
  const authToken = req.headers["x-auth-token"] as string;
  if (authToken) {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.authToken, authToken))
      .limit(1);
    if (user) return user.id;
  }
  return null;
}

router.get("/my-studio", async (req, res) => {
  try {
    const userId = await getUserId(req);
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    const [studio] = await db
      .select()
      .from(studios)
      .where(eq(studios.ownerUserId, userId));
    
    if (!studio) {
      return res.json({ studio: null });
    }

    const [billing] = await db
      .select()
      .from(studioBilling)
      .where(eq(studioBilling.studioId, studio.id));

    res.json({ studio, billing });
  } catch (error) {
    console.error("Error fetching studio:", error);
    res.status(500).json({ error: "Failed to fetch studio" });
  }
});

router.post("/", async (req, res) => {
  try {
    const userId = await getUserId(req);
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    const { name, type, contactEmail, contactPhone } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Studio name is required" });
    }

    const [existing] = await db
      .select()
      .from(studios)
      .where(eq(studios.ownerUserId, userId));

    if (existing) {
      return res.status(400).json({ error: "You already have a studio" });
    }

    const [studio] = await db
      .insert(studios)
      .values({
        ownerUserId: userId,
        name,
        type: type || "studio",
        contactEmail,
        contactPhone,
        status: "active",
      })
      .returning();

    await db.insert(studioBilling).values({
      studioId: studio.id,
      planCode: type === "clinic" ? "clinic_69" : "studio_59",
      status: "trialing",
    });

    res.json({ studio });
  } catch (error) {
    console.error("Error creating studio:", error);
    res.status(500).json({ error: "Failed to create studio" });
  }
});

router.patch("/:studioId", async (req, res) => {
  try {
    const userId = await getUserId(req);
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    const { studioId } = req.params;
    const { name, logoUrl, themeColor, contactEmail, contactPhone } = req.body;

    const [studio] = await db
      .select()
      .from(studios)
      .where(and(eq(studios.id, studioId), eq(studios.ownerUserId, userId)));

    if (!studio) {
      return res.status(404).json({ error: "Studio not found" });
    }

    const [updated] = await db
      .update(studios)
      .set({
        name: name ?? studio.name,
        logoUrl: logoUrl ?? studio.logoUrl,
        themeColor: themeColor ?? studio.themeColor,
        contactEmail: contactEmail ?? studio.contactEmail,
        contactPhone: contactPhone ?? studio.contactPhone,
        updatedAt: new Date(),
      })
      .where(eq(studios.id, studioId))
      .returning();

    res.json({ studio: updated });
  } catch (error) {
    console.error("Error updating studio:", error);
    res.status(500).json({ error: "Failed to update studio" });
  }
});

router.get("/:studioId/clients", async (req, res) => {
  try {
    const userId = await getUserId(req);
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    const { studioId } = req.params;
    const workspace = (req.query.workspace as string) || "trainer";

    const [studio] = await db
      .select()
      .from(studios)
      .where(and(eq(studios.id, studioId), eq(studios.ownerUserId, userId)));

    if (!studio) {
      return res.status(404).json({ error: "Studio not found" });
    }

    const rows = await db
      .select({
        membershipId: studioMemberships.id,
        clientUserId: studioMemberships.clientUserId,
        status: studioMemberships.status,
        activeBoard: users.activeBoard,
        workspace: studioMemberships.workspace,
        isArchived: studioMemberships.isArchived,
        joinedAt: studioMemberships.joinedAt,
        userName: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(studioMemberships)
      .leftJoin(users, eq(users.id, studioMemberships.clientUserId))
      .where(and(
        eq(studioMemberships.studioId, studioId),
        eq(studioMemberships.workspace, workspace),
        eq(studioMemberships.isArchived, false),
        eq(studioMemberships.status, "active")
      ));

    const clients = rows.map(r => ({
      id: r.membershipId,
      clientUserId: r.clientUserId,
      status: r.status,
      assignedBuilder: r.activeBoard ?? null,
      workspace: r.workspace,
      isArchived: r.isArchived,
      joinedAt: r.joinedAt,
      name: r.firstName && r.lastName
        ? `${r.firstName} ${r.lastName}`
        : r.firstName || r.userName || r.email?.split("@")[0] || `Client`,
      email: r.email,
    }));

    res.json({ clients });
  } catch (error) {
    console.error("Error fetching clients:", error);
    res.status(500).json({ error: "Failed to fetch clients" });
  }
});

router.patch("/:studioId/clients/:clientUserId/archive", async (req, res) => {
  try {
    const userId = await getUserId(req);
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    const { studioId, clientUserId } = req.params;

    const [studio] = await db
      .select()
      .from(studios)
      .where(and(eq(studios.id, studioId), eq(studios.ownerUserId, userId)));
    if (!studio) return res.status(404).json({ error: "Studio not found" });

    try { await assertSameOrg(userId, clientUserId); } catch (err) {
      if (handleOrgIsolationError(err, res)) return; throw err;
    }

    // Archive = full ProCare disconnect (deactivates all 3 invariant records atomically)
    await deactivateProCareClient(clientUserId, userId, userId, "provider_archive");

    res.json({ success: true });
  } catch (err) {
    if (err instanceof ActivationError && err.code === "STUDIO_NOT_FOUND") {
      // Studio may not exist yet — fall back to just marking the membership archived
      const { studioId, clientUserId } = req.params;
      await db
        .update(studioMemberships)
        .set({ isArchived: true, status: "revoked", updatedAt: new Date() })
        .where(and(
          eq(studioMemberships.studioId, studioId),
          eq(studioMemberships.clientUserId, clientUserId),
        ));
      return res.json({ success: true });
    }
    console.error("Error archiving client:", err);
    res.status(500).json({ error: "Failed to archive client" });
  }
});

router.patch("/:studioId/clients/:clientUserId/restore", async (req, res) => {
  try {
    const userId = await getUserId(req);
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    const { studioId, clientUserId } = req.params;

    const [studio] = await db
      .select()
      .from(studios)
      .where(and(eq(studios.id, studioId), eq(studios.ownerUserId, userId)));
    if (!studio) return res.status(404).json({ error: "Studio not found" });

    try { await assertSameOrg(userId, clientUserId); } catch (err) {
      if (handleOrgIsolationError(err, res)) return; throw err;
    }

    // For physician studios (clinic type), verify the patient has current legal acceptance
    // before restoring the relationship. On a normal lifecycle the docs are already accepted,
    // so this check passes silently. If the original connection bypassed the gate (legacy),
    // the patient must complete acceptance through the normal connect flow first.
    if (studio.type === "clinic") {
      const legalCheck = await checkLegalAcceptance(clientUserId, "patient_physician");
      if (!legalCheck.allAccepted) {
        return res.status(409).json({
          code: "LEGAL_ACCEPTANCE_REQUIRED",
          missing: legalCheck.missing,
          flow: "patient_physician",
          error: "Patient must accept all required legal documents before this connection can be restored.",
        });
      }
    }

    await activateProCareClient(clientUserId, userId, "provider_unarchive");

    console.log(`♻️ [StudioRestore] Client ${clientUserId} fully reactivated by pro ${userId} (studio ${studioId})`);
    res.json({ success: true });
  } catch (error) {
    console.error("Error restoring client:", error);
    res.status(500).json({ error: "Failed to restore client" });
  }
});

router.post("/:studioId/invite", async (req, res) => {
  try {
    const userId = await getUserId(req);
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    const { studioId } = req.params;
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }
    const emailCandidates = await findEmailIdentityCandidates(String(email));
    if (emailCandidates.length > 1) {
      return res.status(409).json({
        error: "This email address belongs to multiple legacy accounts. Ask an administrator to resolve the account identity before sending an invitation.",
      });
    }

    const [studio] = await db
      .select()
      .from(studios)
      .where(and(eq(studios.id, studioId), eq(studios.ownerUserId, userId)));

    if (!studio) {
      return res.status(404).json({ error: "Studio not found" });
    }

    const inviteCode = `MP-${nanoid(4).toUpperCase()}-${nanoid(3).toUpperCase()}`;
    const urlToken = nanoid(32);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const [invite] = await db
      .insert(studioInvites)
      .values({
        studioId,
        email: email.toLowerCase().trim(),
        inviteCode,
        urlToken,
        expiresAt,
      })
      .returning();

    await logClientActivity(
      studioId,
      invite.id,
      userId,
      "invite_sent",
      "invite",
      invite.id,
      { email, inviteCode, note: "Invite sent - will link to client on acceptance" }
    );

    // Send the invitation email — non-fatal if it fails
    try {
      const role = studio.type === "clinic" ? "physician" : "trainer";
      await sendCareTeamInvite({
        to: email.toLowerCase().trim(),
        patientName: email.split("@")[0],
        inviteCode,
        role,
        urlToken,
      });
    } catch (emailErr) {
      console.error("[StudioInvite] Email send failed (non-fatal):", emailErr);
    }

    res.json({ invite, studioName: studio.name });
  } catch (error) {
    console.error("Error creating invite:", error);
    res.status(500).json({ error: "Failed to create invite" });
  }
});

router.post("/connect", async (req, res) => {
  try {
    const userId = await getUserId(req);
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    const { code, token } = req.body;

    if (!code && !token) {
      return res.status(400).json({ error: "code or token is required" });
    }

    const [invite] = await db
      .select()
      .from(studioInvites)
      .where(
        token
          ? eq(studioInvites.urlToken, token)
          : eq(studioInvites.inviteCode, code)
      );

    if (!invite) {
      return res.status(404).json({ error: "Invalid invite code" });
    }

    // Codes and email links are both account-bound. A code is not safe to
    // redeem merely because it was manually typed or forwarded.
    const identity = await resolveEmailIdentityForUser(userId);
    if (identity.candidates.length > 1) {
      return res.status(409).json({
        error: "EMAIL_IDENTITY_REVIEW_REQUIRED",
        message: "This email address is linked to multiple legacy accounts. An administrator must review the account before this invitation can be accepted.",
      });
    }
    if (
      identity.status !== "unique" ||
      normalizeEmailIdentity(identity.user.email) !== normalizeEmailIdentity(invite.email)
    ) {
      return res.status(403).json({
        error: "This invitation was sent to a different email address. Please sign in with the account that received the invitation.",
      });
    }

    if (new Date() > invite.expiresAt) {
      return res.status(400).json({ error: "Invite code has expired" });
    }

    if (invite.acceptedAt) {
      return res.status(400).json({ error: "Invite code already used" });
    }

    const [studio] = await db
      .select()
      .from(studios)
      .where(eq(studios.id, invite.studioId));

    if (!studio) {
      return res.status(404).json({ error: "Studio not found" });
    }

    const legalFlow = studio.type === "clinic" ? "patient_physician" : "client";
    const consentCheck = await checkLegalAcceptance(userId, legalFlow);
    if (!consentCheck.allAccepted) {
      return res.status(409).json({
        code: "LEGAL_REACCEPT_REQUIRED",
        missing: consentCheck.missing,
        flow: legalFlow,
        error: "Please accept all required legal documents before connecting.",
      });
    }

    let activation;
    try {
      activation = await activateProCareClient(userId, studio.ownerUserId, "studio_invite");
    } catch (err) {
      if (err instanceof ActivationError) {
        if (err.code === "CLIENT_ALREADY_HAS_ACTIVE_PROFESSIONAL") {
          return res.status(409).json({ error: err.code, message: err.message });
        }
        if (err.code === "SELF_ACTIVATION") {
          return res.status(400).json({ error: "You cannot connect to your own studio." });
        }
      }
      throw err;
    }

    await db
      .update(studioInvites)
      .set({ acceptedAt: new Date() })
      .where(eq(studioInvites.id, invite.id));

    res.json({
      membership: { id: activation.membershipId, studioId: activation.studioId },
      studioName: activation.studioName,
    });
  } catch (error) {
    console.error("Error connecting to studio:", error);
    res.status(500).json({ error: "Failed to connect to studio" });
  }
});

router.patch("/:studioId/clients/:clientUserId/assign", async (req, res) => {
  try {
    const userId = await getUserId(req);
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    const { studioId, clientUserId } = req.params;
    const { assignedBuilder } = req.body;

    if (!assignedBuilder || !isValidBuilder(assignedBuilder)) {
      return res.status(400).json({
        error: "Invalid builder",
        message: `Must be one of: ${VALID_BUILDERS.join(", ")}`,
      });
    }

    const [studio] = await db
      .select()
      .from(studios)
      .where(and(eq(studios.id, studioId), eq(studios.ownerUserId, userId)));

    if (!studio) {
      return res.status(404).json({ error: "Studio not found" });
    }

    try { await assertSameOrg(userId, clientUserId); } catch (err) {
      if (handleOrgIsolationError(err, res)) return; throw err;
    }

    const CLINICAL_BUILDERS = ["diabetic", "glp1", "anti_inflammatory", "weekly"];
    if (CLINICAL_BUILDERS.includes(assignedBuilder) && studio.type !== "clinic") {
      return res.status(403).json({
        error: "ClinicalBuilderRestricted",
        message: "This builder requires a verified physician workspace. Contact the assigned physician to assign clinical or protocol-based builders.",
      });
    }

    const result = await assignBuilder(userId, clientUserId, assignedBuilder, {
      studioId,
      actorLabel: studio.type === "clinic" ? "clinical" : "trainer",
    });

    pushToUser(clientUserId, {
      title: "Your coach updated your plan",
      body: "A new meal builder has been assigned. Tap to review.",
      url: "/weekly",
    });

    logAudit({
      actor: userId,
      target: clientUserId,
      orgId: (req as any).authUser?.organizationId ?? null,
      action: "WRITE",
      resourceType: "builder_assignment",
      table: "users",
      field: "active_board",
      route: req.path,
      ip: getClientIp(req as any),
      meta: { assignedBuilder, studioId },
    });

    res.json({ success: true, assignedBuilder: result.activeBoard });
  } catch (error) {
    console.error("Error assigning builder:", error);
    res.status(500).json({ error: "Failed to assign builder" });
  }
});

router.patch("/:studioId/clients/:clientUserId/apply-system-recommendation", async (req, res) => {
  try {
    const userId = await getUserId(req);
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    const { studioId, clientUserId } = req.params;
    const { directiveKey, directiveLabel, protocol } = req.body;

    if (!directiveKey || !directiveLabel) {
      return res.status(400).json({ error: "directiveKey and directiveLabel are required" });
    }

    const ALLOWED_DIRECTIVE_KEYS = ["liverDisease", "renal", "cardiac", "liverSupport", "lowSodium", "postBariatric"];
    if (!ALLOWED_DIRECTIVE_KEYS.includes(directiveKey)) {
      return res.status(400).json({ error: "Invalid directive key" });
    }

    const [studio] = await db
      .select()
      .from(studios)
      .where(and(eq(studios.id, studioId), eq(studios.ownerUserId, userId)));

    if (!studio) {
      return res.status(404).json({ error: "Studio not found" });
    }

    try { await assertSameOrg(userId, clientUserId); } catch (err) {
      if (handleOrgIsolationError(err, res)) return; throw err;
    }

    if (studio.type !== "clinic") {
      return res.status(403).json({
        error: "ClinicalDirectiveRestricted",
        message: "Clinical directives can only be applied by a verified physician workspace. Contact the assigned physician to apply clinical protocols.",
      });
    }

    const [membership] = await db
      .update(studioMemberships)
      .set({ builderSource: "clinical", updatedAt: new Date() })
      .where(
        and(
          eq(studioMemberships.studioId, studioId),
          eq(studioMemberships.clientUserId, clientUserId)
        )
      )
      .returning();

    if (!membership) {
      return res.status(404).json({ error: "Client not found in studio" });
    }

    await logClientActivity(
      studioId,
      clientUserId,
      userId,
      "system_recommendation_applied",
      "membership",
      membership.id,
      {
        directiveKey,
        directiveLabel,
        protocol: protocol ?? null,
        source: "trainer",
        origin: "lab-derived",
      }
    );

    logAudit({ actor: userId, target: clientUserId, orgId: (req as any).authUser?.organizationId ?? null, action: "WRITE", resourceType: "clinical_directive", table: "studio_memberships", field: "builder_source", route: req.path, ip: getClientIp(req as any), meta: { directiveKey, directiveLabel } });
    res.json({ membership, applied: true });
  } catch (error) {
    console.error("Error applying system recommendation:", error);
    res.status(500).json({ error: "Failed to apply system recommendation" });
  }
});

router.get("/:studioId/clients/:clientUserId/notes", async (req, res) => {
  try {
    const userId = await getUserId(req);
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    const { studioId, clientUserId } = req.params;

    const [studio] = await db
      .select()
      .from(studios)
      .where(and(eq(studios.id, studioId), eq(studios.ownerUserId, userId)));

    if (!studio) {
      return res.status(404).json({ error: "Studio not found" });
    }

    try { await assertSameOrg(userId, clientUserId); } catch (err) {
      if (handleOrgIsolationError(err, res)) return; throw err;
    }

    const notes = await db
      .select()
      .from(clientNotes)
      .where(
        and(
          eq(clientNotes.studioId, studioId),
          eq(clientNotes.clientUserId, clientUserId)
        )
      )
      .orderBy(desc(clientNotes.createdAt));

    res.json({ notes });
  } catch (error) {
    console.error("Error fetching notes:", error);
    res.status(500).json({ error: "Failed to fetch notes" });
  }
});

router.post("/:studioId/clients/:clientUserId/notes", async (req, res) => {
  try {
    const userId = await getUserId(req);
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    const { studioId, clientUserId } = req.params;
    const { noteType, title, body, sessionDate, tags, visibility } = req.body;

    if (!body) {
      return res.status(400).json({ error: "Note body is required" });
    }

    const [studio] = await db
      .select()
      .from(studios)
      .where(and(eq(studios.id, studioId), eq(studios.ownerUserId, userId)));

    if (!studio) {
      return res.status(404).json({ error: "Studio not found" });
    }

    try { await assertSameOrg(userId, clientUserId); } catch (err) {
      if (handleOrgIsolationError(err, res)) return; throw err;
    }

    const [note] = await db
      .insert(clientNotes)
      .values({
        studioId,
        clientUserId,
        authorUserId: userId,
        noteType: noteType || "general",
        visibility: visibility || "professional_only",
        title,
        body,
        sessionDate: sessionDate ? new Date(sessionDate) : null,
        tags: tags || [],
      })
      .returning();

    await logClientActivity(
      studioId,
      clientUserId,
      userId,
      "note_added",
      "note",
      note.id,
      { noteType: noteType || "general", title }
    );
    logAudit({ actor: userId, target: clientUserId, orgId: (req as any).authUser?.organizationId ?? null, action: "WRITE", resourceType: "client_note", table: "client_notes", resourceId: note.id, route: req.path, ip: getClientIp(req as any), meta: { noteType: noteType || "general", visibility: visibility || "professional_only" } });
    res.json({ note });
  } catch (error) {
    console.error("Error creating note:", error);
    res.status(500).json({ error: "Failed to create note" });
  }
});

router.get("/:studioId/clients/:clientUserId/activity", async (req, res) => {
  try {
    const userId = await getUserId(req);
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    const { studioId, clientUserId } = req.params;

    const [studio] = await db
      .select()
      .from(studios)
      .where(and(eq(studios.id, studioId), eq(studios.ownerUserId, userId)));

    if (!studio) {
      return res.status(404).json({ error: "Studio not found" });
    }

    try { await assertSameOrg(userId, clientUserId); } catch (err) {
      if (handleOrgIsolationError(err, res)) return; throw err;
    }

    const activities = await db
      .select()
      .from(clientActivityLog)
      .where(
        and(
          eq(clientActivityLog.studioId, studioId),
          eq(clientActivityLog.clientUserId, clientUserId)
        )
      )
      .orderBy(desc(clientActivityLog.createdAt));

    res.json({ activities });
  } catch (error) {
    console.error("Error fetching activity:", error);
    res.status(500).json({ error: "Failed to fetch activity" });
  }
});

router.get("/my-membership", async (req, res) => {
  try {
    const userId = await getUserId(req);
    if (!userId) return res.status(401).json({ error: "Authentication required" });

    const [membership] = await db
      .select()
      .from(studioMemberships)
      .where(eq(studioMemberships.clientUserId, userId));

    if (!membership) {
      return res.json({ membership: null, studio: null });
    }

    const [studio] = await db
      .select()
      .from(studios)
      .where(eq(studios.id, membership.studioId));

    res.json({ membership, studio });
  } catch (error) {
    console.error("Error fetching membership:", error);
    res.status(500).json({ error: "Failed to fetch membership" });
  }
});

export default router;
