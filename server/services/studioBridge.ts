import { db } from "../db";
import { studios, studioBilling, studioMemberships } from "../db/schema/studio";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { logClientActivity } from "./activityLog";

export async function ensureStudioForTrainer(trainerUserId: string): Promise<{ studioId: string; studioName: string; studioType: string } | null> {
  try {
    const [existingStudio] = await db
      .select()
      .from(studios)
      .where(eq(studios.ownerUserId, trainerUserId));

    if (existingStudio) {
      return { studioId: existingStudio.id, studioName: existingStudio.name, studioType: existingStudio.type };
    }

    const [trainer] = await db
      .select()
      .from(users)
      .where(eq(users.id, trainerUserId));

    if (!trainer) return null;

    const isPhysician = trainer.professionalRole === "physician";
    const studioType = isPhysician ? "clinic" : "studio";
    const studioName = isPhysician
      ? `${trainer.firstName || trainer.username || "Dr."}'s Clinic`
      : `${trainer.firstName || trainer.username || "Coach"}'s Studio`;

    const [newStudio] = await db
      .insert(studios)
      .values({
        ownerUserId: trainerUserId,
        name: studioName,
        type: studioType,
        contactEmail: trainer.email,
        status: "active",
      })
      .returning();

    await db.insert(studioBilling).values({
      studioId: newStudio.id,
      planCode: isPhysician ? "clinic_69" : "studio_59",
      status: "trialing",
    });

    console.log(`🏗️ [StudioBridge] Auto-created ${studioType} "${studioName}" for trainer ${trainerUserId}`);

    return { studioId: newStudio.id, studioName: newStudio.name, studioType: newStudio.type };
  } catch (error) {
    console.error("❌ [StudioBridge] Error ensuring studio for trainer:", error);
    return null;
  }
}

export async function ensureStudioMembership(
  studioId: string,
  clientUserId: string,
  workspace: string = "trainer"
): Promise<string | null> {
  try {
    const [existing] = await db
      .select()
      .from(studioMemberships)
      .where(eq(studioMemberships.clientUserId, clientUserId));

    if (existing) {
      if (existing.studioId === studioId) {
        if (existing.workspace !== workspace) {
          await db
            .update(studioMemberships)
            .set({ workspace, updatedAt: new Date() })
            .where(eq(studioMemberships.clientUserId, clientUserId));
          console.log(`🔄 [StudioBridge] Updated workspace to "${workspace}" for client ${clientUserId}`);
        }
        return existing.id;
      }

      const [updated] = await db
        .update(studioMemberships)
        .set({ studioId, workspace, status: "active", updatedAt: new Date() })
        .where(eq(studioMemberships.clientUserId, clientUserId))
        .returning();
      console.log(`🔄 [StudioBridge] Moved client ${clientUserId} from studio ${existing.studioId} to ${studioId} with workspace "${workspace}"`);
      return updated?.id ?? null;
    }

    const [membership] = await db
      .insert(studioMemberships)
      .values({
        studioId,
        clientUserId,
        status: "active",
        workspace,
        joinedAt: new Date(),
      })
      .returning();

    return membership.id;
  } catch (error) {
    console.error("❌ [StudioBridge] Error ensuring studio membership:", error);
    return null;
  }
}

export async function bridgeToStudio(
  trainerUserId: string,
  clientUserId: string,
  source: string
): Promise<{ studioId: string; studioName: string; membershipId: string } | null> {
  try {
    const studioInfo = await ensureStudioForTrainer(trainerUserId);
    if (!studioInfo) {
      console.error(`❌ [StudioBridge] Could not create/find studio for trainer ${trainerUserId}`);
      return null;
    }

    const workspace = studioInfo.studioType === "clinic" ? "clinician" : "trainer";

    const membershipId = await ensureStudioMembership(studioInfo.studioId, clientUserId, workspace);
    if (!membershipId) {
      console.error(`❌ [StudioBridge] Could not create membership for client ${clientUserId}`);
      return null;
    }

    await logClientActivity(
      studioInfo.studioId,
      clientUserId,
      clientUserId,
      "invite_accepted",
      "membership",
      membershipId,
      { source, studioName: studioInfo.studioName }
    );

    console.log(`✅ [StudioBridge] Client ${clientUserId} bridged to studio "${studioInfo.studioName}" workspace="${workspace}" (source: ${source})`);

    return {
      studioId: studioInfo.studioId,
      studioName: studioInfo.studioName,
      membershipId,
    };
  } catch (error) {
    console.error("❌ [StudioBridge] Error bridging to studio:", error);
    return null;
  }
}
