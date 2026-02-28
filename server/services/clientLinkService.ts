import { db } from "../db";
import { clientLinks } from "../db/schema/procare";
import { eq, and } from "drizzle-orm";

export class ClientLinkError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "ClientLinkError";
  }
}

export async function getActiveLink(clientUserId: string) {
  const [link] = await db
    .select()
    .from(clientLinks)
    .where(
      and(
        eq(clientLinks.clientUserId, clientUserId),
        eq(clientLinks.active, true)
      )
    )
    .limit(1);

  return link ?? null;
}

export async function createLink(clientUserId: string, proUserId: string) {
  const existing = await getActiveLink(clientUserId);
  if (existing) {
    throw new ClientLinkError(
      "CLIENT_ALREADY_HAS_ACTIVE_PROFESSIONAL",
      `Client ${clientUserId} already has an active professional relationship with ${existing.proUserId}`
    );
  }

  try {
    const [link] = await db
      .insert(clientLinks)
      .values({ clientUserId, proUserId, active: true })
      .returning();

    console.log(`✅ [ClientLink] Created link: client=${clientUserId} pro=${proUserId}`);
    return link;
  } catch (error: any) {
    if (error?.code === "23505" && error?.constraint?.includes("single_active")) {
      throw new ClientLinkError(
        "CLIENT_ALREADY_HAS_ACTIVE_PROFESSIONAL",
        `Client ${clientUserId} already has an active professional relationship (DB constraint)`
      );
    }
    throw error;
  }
}

export async function endLink(clientUserId: string, proUserId: string) {
  const [updated] = await db
    .update(clientLinks)
    .set({ active: false })
    .where(
      and(
        eq(clientLinks.clientUserId, clientUserId),
        eq(clientLinks.proUserId, proUserId),
        eq(clientLinks.active, true)
      )
    )
    .returning();

  if (updated) {
    console.log(`✅ [ClientLink] Ended link: client=${clientUserId} pro=${proUserId}`);
  } else {
    console.log(`ℹ️ [ClientLink] No active link found to end: client=${clientUserId} pro=${proUserId}`);
  }

  return { ok: true };
}
