import { Router } from "express";
import { db } from "../db";
import { 
  studios, studioBilling, studioMemberships, studioInvites, 
  clientNotes, clientActivityLog 
} from "../db/schema/studio";
import { eq, and, desc } from "drizzle-orm";
import { nanoid } from "nanoid";

const router = Router();

function getUserId(req: any): string {
  if (req.session?.userId) return req.session.userId as string;
  const headerUserId = req.headers["x-user-id"] as string;
  if (headerUserId) return headerUserId;
  return "00000000-0000-0000-0000-000000000001";
}

type ActivityAction = 
  | "membership_created" | "membership_activated" | "membership_paused"
  | "builder_assigned" | "board_created" | "board_updated" | "board_deleted"
  | "program_updated" | "macros_updated" | "settings_changed"
  | "invite_sent" | "invite_accepted" | "note_added";

async function logClientActivity(
  studioId: string,
  clientUserId: string,
  actorUserId: string,
  action: ActivityAction,
  entityType?: string,
  entityId?: string,
  metadata?: Record<string, any>
) {
  try {
    await db.insert(clientActivityLog).values({
      studioId,
      clientUserId,
      actorUserId,
      action,
      entityType,
      entityId,
      metadata: metadata || {},
    });
  } catch (error) {
    console.error("Failed to log activity:", error);
  }
}

router.get("/my-studio", async (req, res) => {
  try {
    const userId = getUserId(req);
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
    const userId = getUserId(req);
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
    const userId = getUserId(req);
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
    const userId = getUserId(req);
    const { studioId } = req.params;

    const [studio] = await db
      .select()
      .from(studios)
      .where(and(eq(studios.id, studioId), eq(studios.ownerUserId, userId)));

    if (!studio) {
      return res.status(404).json({ error: "Studio not found" });
    }

    const members = await db
      .select()
      .from(studioMemberships)
      .where(eq(studioMemberships.studioId, studioId));

    res.json({ clients: members });
  } catch (error) {
    console.error("Error fetching clients:", error);
    res.status(500).json({ error: "Failed to fetch clients" });
  }
});

router.post("/:studioId/invite", async (req, res) => {
  try {
    const userId = getUserId(req);
    const { studioId } = req.params;
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const [studio] = await db
      .select()
      .from(studios)
      .where(and(eq(studios.id, studioId), eq(studios.ownerUserId, userId)));

    if (!studio) {
      return res.status(404).json({ error: "Studio not found" });
    }

    const inviteCode = `MP-${nanoid(4).toUpperCase()}-${nanoid(3).toUpperCase()}`;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const [invite] = await db
      .insert(studioInvites)
      .values({
        studioId,
        email: email.toLowerCase().trim(),
        inviteCode,
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

    res.json({ invite, studioName: studio.name });
  } catch (error) {
    console.error("Error creating invite:", error);
    res.status(500).json({ error: "Failed to create invite" });
  }
});

router.post("/connect", async (req, res) => {
  try {
    const userId = getUserId(req);
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: "Code is required" });
    }

    const [invite] = await db
      .select()
      .from(studioInvites)
      .where(eq(studioInvites.inviteCode, code));

    if (!invite) {
      return res.status(404).json({ error: "Invalid invite code" });
    }

    if (new Date() > invite.expiresAt) {
      return res.status(400).json({ error: "Invite code has expired" });
    }

    if (invite.acceptedAt) {
      return res.status(400).json({ error: "Invite code already used" });
    }

    const [existingMembership] = await db
      .select()
      .from(studioMemberships)
      .where(eq(studioMemberships.clientUserId, userId));

    if (existingMembership) {
      return res.status(400).json({ error: "You are already connected to a studio" });
    }

    const [membership] = await db
      .insert(studioMemberships)
      .values({
        studioId: invite.studioId,
        clientUserId: userId,
        status: "active",
        joinedAt: new Date(),
      })
      .returning();

    await db
      .update(studioInvites)
      .set({ acceptedAt: new Date() })
      .where(eq(studioInvites.id, invite.id));

    const [studio] = await db
      .select()
      .from(studios)
      .where(eq(studios.id, invite.studioId));

    await logClientActivity(
      invite.studioId,
      userId,
      userId,
      "invite_accepted",
      "membership",
      membership.id,
      { studioName: studio?.name }
    );

    await logClientActivity(
      invite.studioId,
      userId,
      studio?.ownerUserId || userId,
      "membership_created",
      "membership",
      membership.id,
      {}
    );

    res.json({ membership, studioName: studio?.name });
  } catch (error) {
    console.error("Error connecting to studio:", error);
    res.status(500).json({ error: "Failed to connect to studio" });
  }
});

router.patch("/:studioId/clients/:clientUserId/assign", async (req, res) => {
  try {
    const userId = getUserId(req);
    const { studioId, clientUserId } = req.params;
    const { assignedBuilder, activeBoardId } = req.body;

    const [studio] = await db
      .select()
      .from(studios)
      .where(and(eq(studios.id, studioId), eq(studios.ownerUserId, userId)));

    if (!studio) {
      return res.status(404).json({ error: "Studio not found" });
    }

    const [membership] = await db
      .update(studioMemberships)
      .set({
        assignedBuilder,
        activeBoardId,
        updatedAt: new Date(),
      })
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
      "builder_assigned",
      "membership",
      membership.id,
      { assignedBuilder, activeBoardId }
    );

    res.json({ membership });
  } catch (error) {
    console.error("Error assigning builder:", error);
    res.status(500).json({ error: "Failed to assign builder" });
  }
});

router.get("/:studioId/clients/:clientUserId/notes", async (req, res) => {
  try {
    const userId = getUserId(req);
    const { studioId, clientUserId } = req.params;

    const [studio] = await db
      .select()
      .from(studios)
      .where(and(eq(studios.id, studioId), eq(studios.ownerUserId, userId)));

    if (!studio) {
      return res.status(404).json({ error: "Studio not found" });
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
    const userId = getUserId(req);
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

    res.json({ note });
  } catch (error) {
    console.error("Error creating note:", error);
    res.status(500).json({ error: "Failed to create note" });
  }
});

router.get("/:studioId/clients/:clientUserId/activity", async (req, res) => {
  try {
    const userId = getUserId(req);
    const { studioId, clientUserId } = req.params;

    const [studio] = await db
      .select()
      .from(studios)
      .where(and(eq(studios.id, studioId), eq(studios.ownerUserId, userId)));

    if (!studio) {
      return res.status(404).json({ error: "Studio not found" });
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
    const userId = getUserId(req);

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

export { logClientActivity };
export default router;
