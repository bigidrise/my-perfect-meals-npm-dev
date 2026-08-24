import { and, eq, lte } from "drizzle-orm";
import { db } from "../db";
import { studioVideoMedia, studioVideoMessages } from "../db/schema/studio";
import { deleteStudioVideoFromS3 } from "./tabletVoiceService";
import { logAudit } from "../lib/auditLog";

/**
 * Removes the private object after a verified viewer's 24-hour window ends.
 * The parent message survives as an auditable communication record; no media
 * URL, object key, or transcript is emitted from this worker.
 */
export async function expireStudioVideoMedia(now = new Date()): Promise<number> {
  const expired = await db
    .select({
      media: studioVideoMedia,
      message: studioVideoMessages,
    })
    .from(studioVideoMedia)
    .innerJoin(studioVideoMessages, eq(studioVideoMessages.id, studioVideoMedia.messageId))
    .where(
      and(
        eq(studioVideoMedia.state, "expiration_pending"),
        lte(studioVideoMedia.expiresAt, now),
      ),
    )
    .limit(100);

  for (const record of expired) {
    await db.update(studioVideoMedia)
      .set({ state: "expired", updatedAt: now })
      .where(eq(studioVideoMedia.id, record.media.id));
    await db.update(studioVideoMedia)
      .set({ state: "deleting", updatedAt: now })
      .where(eq(studioVideoMedia.id, record.media.id));

    try {
      if (record.media.objectKey) {
        await deleteStudioVideoFromS3(record.media.objectKey);
      }
      for (const derivativeKey of record.media.temporaryDerivativeKeys) {
        await deleteStudioVideoFromS3(derivativeKey);
      }
      await db.update(studioVideoMedia)
        .set({
          state: "deleted",
          objectKey: null,
          temporaryDerivativeKeys: [],
          deletedAt: now,
          updatedAt: now,
        })
        .where(eq(studioVideoMedia.id, record.media.id));
      logAudit({
        actor: "system",
        target: record.message.clientUserId,
        action: "DELETE",
        resourceType: "studio_video_message",
        table: "studio_video_media",
        resourceId: record.message.id,
        meta: { action: "expired_media_deleted" },
      });
    } catch (error) {
      console.error("[studioVideoExpiryWorker] Failed to delete expired video media", error);
      await db.update(studioVideoMedia)
        .set({ state: "deletion_failed", updatedAt: new Date() })
        .where(eq(studioVideoMedia.id, record.media.id));
    }
  }

  return expired.length;
}

export function startStudioVideoExpiryWorker(): void {
  void expireStudioVideoMedia().catch((error) => {
    console.error("[studioVideoExpiryWorker] Initial expiry scan failed", error);
  });
  setInterval(() => {
    void expireStudioVideoMedia().catch((error) => {
      console.error("[studioVideoExpiryWorker] Expiry scan failed", error);
    });
  }, 5 * 60 * 1000);
}