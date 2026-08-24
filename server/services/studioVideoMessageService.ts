import { Request } from "express";
import crypto from "crypto";
import { and, asc, eq } from "drizzle-orm";
import { db } from "../db";
import {
  studioVideoMedia,
  studioVideoMessages,
} from "../db/schema/studio";
import {
  assertStudioVideoMessagesEnabled,
  createStudioVideoAuditEvent,
  type StudioVideoAuditEvent,
  type StudioVideoMediaState,
  type StudioVideoMessageSender,
} from "@shared/studioVideoMessages";
import { logAudit, getClientIp } from "../lib/auditLog";
import { STUDIO_VIDEO_MESSAGES_DEFAULT_ENABLED } from "@shared/studioVideoMessages";

export type StudioVideoListEntry = {
  id: string;
  body: string;
  authorUserId: string;
  recipientUserId: string;
  entryType: "message";
  visibility: "shared_with_client";
  sender: StudioVideoMessageSender;
  contentType: "video";
  createdAt: Date;
  videoMediaState: StudioVideoMediaState;
  videoDurationSec: number;
  videoWatchCompletedAt: Date | null;
  videoExpiresAt: Date | null;
  videoTranscriptStatus: "pending" | "completed" | "failed" | "blocked";
  videoModerationStatus: "pending" | "approved" | "blocked";
};

export function assertStudioVideoFeatureEnabled(): void {
  const configured = process.env.STUDIO_VIDEO_MESSAGES_ENABLED;
  const enabled =
    configured === undefined
      ? STUDIO_VIDEO_MESSAGES_DEFAULT_ENABLED
      : configured === "true";
  assertStudioVideoMessagesEnabled(enabled);
}

const playbackTokens = new Map<string, { messageId: string; actorUserId: string; expiresAt: number }>();
export function issueStudioVideoPlaybackToken(messageId: string, actorUserId: string): string {
  const token = crypto.randomUUID();
  playbackTokens.set(token, { messageId, actorUserId, expiresAt: Date.now() + 5 * 60 * 1000 });
  return token;
}
export function isValidStudioVideoPlaybackToken(token: unknown, messageId: string, actorUserId: string): boolean {
  if (typeof token !== "string") return false;
  const entry = playbackTokens.get(token);
  if (!entry || entry.expiresAt < Date.now()) {
    playbackTokens.delete(token);
    return false;
  }
  return entry.messageId === messageId && entry.actorUserId === actorUserId;
}

export async function listStudioVideoMessages(
  studioId: string,
  clientUserId: string,
): Promise<StudioVideoListEntry[]> {
  const rows = await db
    .select({
      id: studioVideoMessages.id,
      body: studioVideoMessages.body,
      authorUserId: studioVideoMessages.authorUserId,
      recipientUserId: studioVideoMessages.recipientUserId,
      sender: studioVideoMessages.sender,
      visibility: studioVideoMessages.visibility,
      contentType: studioVideoMessages.contentType,
      createdAt: studioVideoMessages.createdAt,
      transcriptStatus: studioVideoMessages.transcriptStatus,
      mediaState: studioVideoMedia.state,
      durationSec: studioVideoMedia.durationSec,
      watchCompletedAt: studioVideoMedia.watchCompletedAt,
      expiresAt: studioVideoMedia.expiresAt,
      moderationStatus: studioVideoMedia.moderationStatus,
    })
    .from(studioVideoMessages)
    .innerJoin(studioVideoMedia, eq(studioVideoMedia.messageId, studioVideoMessages.id))
    .where(
      and(
        eq(studioVideoMessages.studioId, studioId),
        eq(studioVideoMessages.clientUserId, clientUserId),
        eq(studioVideoMessages.visibility, "shared_with_client"),
      ),
    )
    .orderBy(asc(studioVideoMessages.createdAt));

  return rows.map((row) => ({
    id: row.id,
    // Deliberately generic: video bytes and transcripts are never included in
    // message previews or notification payloads.
    body: "Video message",
    authorUserId: row.authorUserId,
    recipientUserId: row.recipientUserId,
    entryType: "message",
    visibility: "shared_with_client",
    sender: row.sender as StudioVideoMessageSender,
    contentType: "video",
    createdAt: row.createdAt,
    videoMediaState: row.mediaState as StudioVideoMediaState,
    videoDurationSec: row.durationSec,
    videoWatchCompletedAt: row.watchCompletedAt,
    videoExpiresAt: row.expiresAt,
    videoTranscriptStatus: row.transcriptStatus as StudioVideoListEntry["videoTranscriptStatus"],
    videoModerationStatus: row.moderationStatus as StudioVideoListEntry["videoModerationStatus"],
  }));
}

export async function getStudioVideoMessage(
  studioId: string,
  clientUserId: string,
  messageId: string,
) {
  const [row] = await db
    .select({
      message: studioVideoMessages,
      media: studioVideoMedia,
    })
    .from(studioVideoMessages)
    .innerJoin(studioVideoMedia, eq(studioVideoMedia.messageId, studioVideoMessages.id))
    .where(
      and(
        eq(studioVideoMessages.id, messageId),
        eq(studioVideoMessages.studioId, studioId),
        eq(studioVideoMessages.clientUserId, clientUserId),
        eq(studioVideoMessages.visibility, "shared_with_client"),
      ),
    )
    .limit(1);
  return row ?? null;
}

export function auditStudioVideoAction(input: {
  req: Request;
  event: StudioVideoAuditEvent;
  actorUserId: string;
  targetUserId: string;
  studioId: string;
  messageId: string;
  metadata?: Record<string, unknown>;
}): void {
  const record = createStudioVideoAuditEvent({
    event: input.event,
    actorUserId: input.actorUserId,
    targetUserId: input.targetUserId,
    studioId: input.studioId,
    messageId: input.messageId,
    occurredAt: new Date(),
    metadata: input.metadata,
  });
  const readEvents = new Set<StudioVideoAuditEvent>([
    "playback_authorized",
  ]);
  logAudit({
    actor: record.actorUserId,
    target: record.targetUserId,
    orgId: (input.req as any).authUser?.organizationId ?? null,
    action: readEvents.has(record.event) ? "READ" : "WRITE",
    resourceType: "studio_video_message",
    table: "studio_video_messages",
    resourceId: record.messageId,
    route: input.req.path,
    ip: getClientIp(input.req as any),
    meta: record.metadata,
  });
}

export function auditStudioVideoListAction(input: {
  req: Request;
  actorUserId: string;
  targetUserId: string;
  messageId: string;
}): void {
  logAudit({
    actor: input.actorUserId,
    target: input.targetUserId,
    orgId: (input.req as any).authUser?.organizationId ?? null,
    action: "READ",
    resourceType: "studio_video_message",
    table: "studio_video_messages",
    resourceId: input.messageId,
    route: input.req.path,
    ip: getClientIp(input.req as any),
    meta: { action: "listed" },
  });
}