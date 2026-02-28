import { db } from "../db";
import { users } from "../../shared/schema";
import { eq } from "drizzle-orm";
import webpush from "web-push";

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails("mailto:support@myperfectmeals.app", process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  } catch {}
} else {
  console.warn("[BoardDigest] VAPID keys not configured — push notifications will not be sent.");
}

async function runBoardDigest() {
  try {
    const pending = await db
      .select({ id: users.id, pushTokens: users.pushTokens })
      .from(users)
      .where(eq(users.boardUpdatePending, true));

    if (pending.length === 0) {
      console.log("[BoardDigest] No pending board updates.");
      return;
    }

    console.log(`[BoardDigest] Processing ${pending.length} user(s) with pending board updates.`);

    const payload = JSON.stringify({
      title: "Your Meal Plan Was Updated",
      body: "Your coach updated your meal plan today. Tap to review.",
      data: { url: "/dashboard" },
    });

    for (const user of pending) {
      const tokens: any[] = Array.isArray(user.pushTokens) ? user.pushTokens : [];

      if (tokens.length > 0) {
        const results = await Promise.allSettled(
          tokens.map((sub) => webpush.sendNotification(sub, payload).catch(() => null))
        );
        const sent = results.filter((r) => r.status === "fulfilled").length;
        console.log(`[BoardDigest] Sent push to user ${user.id} (${sent}/${tokens.length} tokens)`);
      } else {
        console.log(`[BoardDigest] No push tokens for user ${user.id}, skipping push.`);
      }

      await db
        .update(users)
        .set({ boardUpdatePending: false })
        .where(eq(users.id, user.id));
    }

    console.log(`[BoardDigest] Complete. Processed ${pending.length} user(s).`);
  } catch (err) {
    console.error("[BoardDigest] Error running digest:", err);
  }
}

function getMsUntilMidnight(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime() - now.getTime();
}

let digestInterval: ReturnType<typeof setInterval> | null = null;

export function startBoardDigestJob() {
  const msUntilMidnight = getMsUntilMidnight();
  console.log(`[BoardDigest] First run scheduled in ${Math.round(msUntilMidnight / 60000)} minutes (midnight server time).`);

  setTimeout(() => {
    runBoardDigest();

    digestInterval = setInterval(() => {
      runBoardDigest();
    }, 24 * 60 * 60 * 1000);
  }, msUntilMidnight);
}
