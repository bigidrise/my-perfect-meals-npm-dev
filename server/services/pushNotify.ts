import { sendPushToSubscription } from "./push";
import { db } from "../db";
import { users } from "../../shared/schema";
import { studios, studioMemberships } from "../db/schema/studio";
import { eq } from "drizzle-orm";

interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

export async function pushToUser(userId: string, payload: PushPayload): Promise<void> {
  try {
    const [user] = await db
      .select({ pushTokens: users.pushTokens })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) return;

    const tokens: any[] = (user.pushTokens as any[]) || [];
    if (tokens.length === 0) return;

    const pushData = {
      title: payload.title,
      body: payload.body,
      data: {
        url: payload.url || "/",
        timestamp: new Date().toISOString(),
      },
    };

    const results = await Promise.allSettled(
      tokens.map((sub) => sendPushToSubscription(sub, pushData))
    );

    const sent = results.filter((r) => r.status === "fulfilled").length;
    if (sent > 0) {
      console.log(`📨 Push sent to ${sent}/${tokens.length} subscriptions for user ${userId}`);
    }
  } catch (error) {
    console.error(`Push to user ${userId} failed:`, error);
  }
}

export async function pushToCoachOfClient(clientUserId: string, payload: PushPayload): Promise<void> {
  try {
    const rows = await db
      .select({ ownerUserId: studios.ownerUserId })
      .from(studioMemberships)
      .innerJoin(studios, eq(studios.id, studioMemberships.studioId))
      .where(eq(studioMemberships.clientUserId, clientUserId))
      .limit(1);

    if (rows.length === 0) return;

    await pushToUser(rows[0].ownerUserId, payload);
  } catch (error) {
    console.error(`Push to coach of client ${clientUserId} failed:`, error);
  }
}
