import { Router } from "express";
import { db } from "../db";
import { careTeamMember, careInvite, careAccessCode } from "../db/schema/careTeam";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { sendCareTeamInvite } from "../services/emailService";

const router = Router();

function getUserId(req: any): string {
  if (req.session?.userId) return req.session.userId as string;
  const headerUserId = req.headers["x-user-id"] as string;
  if (headerUserId) return headerUserId;
  return "00000000-0000-0000-0000-000000000001";
}

router.get("/", async (req, res) => {
  try {
    const userId = getUserId(req);

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

router.post("/invite", async (req, res) => {
  try {
    const userId = getUserId(req);

    const { email, role, permissions } = req.body;
    if (!email || !role || !permissions) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const inviteCode = `MP-${nanoid(4).toUpperCase()}-${nanoid(3).toUpperCase()}`;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const [member] = await db
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

    await db.insert(careInvite).values({
      userId,
      email,
      role,
      permissions,
      inviteCode,
      expiresAt,
    });

    const userName = "Your client";

    await sendCareTeamInvite({
      to: email,
      patientName: userName,
      inviteCode,
      role,
    });

    res.json({ member });
  } catch (error) {
    console.error("❌ Error sending invite:", error);
    res.status(500).json({ error: "Failed to send invite" });
  }
});

router.post("/connect", async (req, res) => {
  try {
    const userId = getUserId(req);

    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: "Missing code" });
    }

    const [invite] = await db
      .select()
      .from(careInvite)
      .where(eq(careInvite.inviteCode, code));

    if (invite) {
      if (new Date() > invite.expiresAt) {
        return res.status(400).json({ error: "Invite expired" });
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

      if (!existingMember) {
        return res.status(404).json({ error: "Member not found" });
      }

      const [updatedMember] = await db
        .update(careTeamMember)
        .set({
          proUserId: userId,
          status: "active",
          updatedAt: new Date(),
        })
        .where(eq(careTeamMember.id, existingMember.id))
        .returning();

      await db
        .update(careInvite)
        .set({ accepted: true })
        .where(eq(careInvite.id, invite.id));

      return res.json({ member: updatedMember });
    }

    const [accessCode] = await db
      .select()
      .from(careAccessCode)
      .where(eq(careAccessCode.code, code));

    if (accessCode) {
      if (new Date() > accessCode.expiresAt) {
        return res.status(400).json({ error: "Code expired" });
      }

      const [newMember] = await db
        .insert(careTeamMember)
        .values({
          userId,
          proUserId: accessCode.proUserId,
          name: `Linked-${code.slice(-4)}`,
          role: "other",
          status: "active",
          permissions: {
            canViewMacros: true,
            canAddMeals: false,
            canEditPlan: false,
          },
        })
        .returning();

      return res.json({ member: newMember });
    }

    return res.status(404).json({ error: "Invalid code" });
  } catch (error) {
    console.error("❌ Error connecting with code:", error);
    res.status(500).json({ error: "Failed to connect" });
  }
});

router.post("/:id/approve", async (req, res) => {
  try {
    const userId = getUserId(req);

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

router.post("/:id/revoke", async (req, res) => {
  try {
    const userId = getUserId(req);

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

    res.json({ ok: true });
  } catch (error) {
    console.error("❌ Error revoking member:", error);
    res.status(500).json({ error: "Failed to revoke member" });
  }
});

export default router;
