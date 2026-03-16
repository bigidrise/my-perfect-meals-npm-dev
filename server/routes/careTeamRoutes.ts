import { Router } from "express";
import { db } from "../db";
import { careTeamMember, careInvite, careAccessCode } from "../db/schema/careTeam";
import { users } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { sendCareTeamInvite } from "../services/emailService";
import { bridgeToStudio } from "../services/studioBridge";
import { createLink, endLink, ClientLinkError } from "../services/clientLinkService";
import { requireAuth, AuthenticatedRequest } from "../middleware/requireAuth";
import { checkLegalAcceptance } from "../services/legalCheck";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;

    const members = await db
      .select()
      .from(careTeamMember)
      .where(eq(careTeamMember.userId, userId));

    res.json({ members });
  } catch (error) {
    console.error("❌ Error fetching care team:", error);
    res.status(500).json({ error: "Failed to fetch care team" });
  }
});

router.post("/invite", requireAuth, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;

    const { email: rawEmail, role, permissions } = req.body;
    if (!rawEmail || !role || !permissions) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const email = String(rawEmail).trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email format. Please enter a valid email address." });
    }

    console.log(`📧 Care Team invite request - role: ${role}`);

    const inviteCode = `MP-${nanoid(4).toUpperCase()}-${nanoid(3).toUpperCase()}`;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const [caller] = await db
      .select({ professionalRole: users.professionalRole })
      .from(users)
      .where(eq(users.id, userId));
    const callerIsPro = ["physician", "trainer"].includes(caller?.professionalRole || "");

    let member = null;
    if (!callerIsPro) {
      const [m] = await db
        .insert(careTeamMember)
        .values({
          userId,
          name: email.split("@")[0],
          email,
          role,
          status: "pending",
          permissions,
        })
        .returning();
      member = m;
    } else {
      console.log(`ℹ️ [CareTeam Invite] Pro caller (${caller?.professionalRole}) inviting patient — deferring careTeamMember creation to /connect to ensure correct direction`);
    }

    await db.insert(careInvite).values({
      userId,
      email,
      role,
      permissions,
      inviteCode,
      expiresAt,
    });

    await sendCareTeamInvite({
      to: email,
      patientName: "Your client",
      inviteCode,
      role,
    });

    res.json({ member: member ?? { email, role, status: "pending" } });
  } catch (error) {
    console.error("❌ Error sending invite:", error);
    res.status(500).json({ error: "Failed to send invite" });
  }
});

router.post("/connect", requireAuth, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;

    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: "Missing code" });
    }

    const trimmedCode = String(code).trim();
    console.log(`🔍 [CareTeam Connect] Attempting code: "${trimmedCode}" (original: "${code}")`);

    const [invite] = await db
      .select()
      .from(careInvite)
      .where(eq(careInvite.inviteCode, trimmedCode));

    const [accessCodeRow] = !invite
      ? await db.select().from(careAccessCode).where(eq(careAccessCode.code, trimmedCode))
      : [null];

    if (!invite && !accessCodeRow) {
      console.log(`❌ [CareTeam Connect] Code "${trimmedCode}" not found in careInvite or careAccessCode tables`);
      return res.status(404).json({ error: "Invalid code" });
    }

    const proUserId = invite ? invite.userId : accessCodeRow!.proUserId;
    const [pro] = await db.select({ professionalRole: users.professionalRole }).from(users).where(eq(users.id, proUserId));
    const isPhysician = pro?.professionalRole === "physician";
    const legalFlow = isPhysician ? "patient_physician" : "client";

    const clientCheck = await checkLegalAcceptance(userId, legalFlow);
    if (!clientCheck.allAccepted) {
      return res.status(409).json({
        code: "LEGAL_REACCEPT_REQUIRED",
        missing: clientCheck.missing,
        flow: legalFlow,
        professionalRole: pro?.professionalRole || "trainer",
        error: isPhysician
          ? "Please accept all required patient agreements before connecting with your physician."
          : "Please accept all required legal documents before connecting with a coach.",
      });
    }

    if (invite) {
      if (new Date() > invite.expiresAt) {
        return res.status(400).json({ error: "Invite expired" });
      }

      const [inviter] = await db
        .select({ professionalRole: users.professionalRole })
        .from(users)
        .where(eq(users.id, invite.userId));
      const inviterIsPro = ["physician", "trainer"].includes(inviter?.professionalRole || "");

      const patientId = inviterIsPro ? userId : invite.userId;
      const resolvedProId = inviterIsPro ? invite.userId : userId;

      try {
        await createLink(patientId, resolvedProId);
      } catch (err) {
        if (err instanceof ClientLinkError && err.code === "CLIENT_ALREADY_HAS_ACTIVE_PROFESSIONAL") {
          return res.status(409).json({ error: err.code, message: err.message });
        }
        throw err;
      }

      const [existingMember] = await db
        .select()
        .from(careTeamMember)
        .where(
          and(
            eq(careTeamMember.userId, invite.userId),
            eq(careTeamMember.email, invite.email)
          )
        );

      let finalMember;

      if (existingMember) {
        if (inviterIsPro) {
          await db.delete(careTeamMember).where(eq(careTeamMember.id, existingMember.id));
          const [newMember] = await db
            .insert(careTeamMember)
            .values({
              userId: patientId,
              proUserId: resolvedProId,
              name: existingMember.name,
              email: existingMember.email,
              role: existingMember.role,
              status: "active",
              permissions: existingMember.permissions,
            })
            .returning();
          finalMember = newMember;
          console.log(`✅ [CareTeam Connect] Replaced inverted careTeamMember with correct direction (userId=patient, proUserId=pro)`);
        } else {
          const [updatedMember] = await db
            .update(careTeamMember)
            .set({ proUserId: resolvedProId, status: "active", updatedAt: new Date() })
            .where(eq(careTeamMember.id, existingMember.id))
            .returning();
          finalMember = updatedMember;
        }
      } else {
        const [newMember] = await db
          .insert(careTeamMember)
          .values({
            userId: patientId,
            proUserId: resolvedProId,
            name: invite.email.split("@")[0],
            email: invite.email,
            role: invite.role,
            status: "active",
            permissions: invite.permissions,
          })
          .returning();
        finalMember = newMember;
        console.log(`✅ [CareTeam Connect] Created careTeamMember (no prior record found)`);
      }

      await db
        .update(careInvite)
        .set({ accepted: true })
        .where(eq(careInvite.id, invite.id));

      await db.update(users).set({ isProCare: true, role: "client" }).where(eq(users.id, patientId));

      const bridge = await bridgeToStudio(resolvedProId, patientId, "care_team_connect_code");

      return res.json({ member: finalMember, studio: bridge });
    }

    if (accessCodeRow) {
      if (new Date() > accessCodeRow.expiresAt) {
        return res.status(400).json({ error: "Code expired" });
      }

      try {
        await createLink(userId, accessCodeRow.proUserId);
      } catch (err) {
        if (err instanceof ClientLinkError && err.code === "CLIENT_ALREADY_HAS_ACTIVE_PROFESSIONAL") {
          return res.status(409).json({ error: err.code, message: err.message });
        }
        throw err;
      }

      const [newMember] = await db
        .insert(careTeamMember)
        .values({
          userId,
          proUserId: accessCodeRow.proUserId,
          name: `Linked-${trimmedCode.slice(-4)}`,
          role: "other",
          status: "active",
          permissions: {
            canViewMacros: true,
            canAddMeals: false,
            canEditPlan: false,
          },
        })
        .returning();

      await db.update(users).set({ isProCare: true, role: "client" }).where(eq(users.id, userId));

      const bridge = await bridgeToStudio(accessCodeRow.proUserId, userId, "care_team_access_code");

      return res.json({ member: newMember, studio: bridge });
    }
  } catch (error) {
    console.error("❌ Error connecting with code:", error);
    res.status(500).json({ error: "Failed to connect" });
  }
});

router.post("/:id/approve", requireAuth, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;

    const { id } = req.params;

    const [existing] = await db
      .select()
      .from(careTeamMember)
      .where(
        and(eq(careTeamMember.id, id), eq(careTeamMember.userId, userId))
      );

    if (!existing) {
      return res.status(404).json({ error: "Member not found" });
    }

    await db
      .update(careTeamMember)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(careTeamMember.id, id));

    res.json({ ok: true });
  } catch (error) {
    console.error("❌ Error approving member:", error);
    res.status(500).json({ error: "Failed to approve member" });
  }
});

router.post("/:id/revoke", requireAuth, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;

    const { id } = req.params;

    const [existing] = await db
      .select()
      .from(careTeamMember)
      .where(
        and(eq(careTeamMember.id, id), eq(careTeamMember.userId, userId))
      );

    if (!existing) {
      return res.status(404).json({ error: "Member not found" });
    }

    await db
      .update(careTeamMember)
      .set({ status: "revoked", updatedAt: new Date() })
      .where(eq(careTeamMember.id, id));

    if (existing.proUserId) {
      await endLink(existing.userId, existing.proUserId);
    }

    res.json({ ok: true });
  } catch (error) {
    console.error("❌ Error revoking member:", error);
    res.status(500).json({ error: "Failed to revoke member" });
  }
});

export default router;
