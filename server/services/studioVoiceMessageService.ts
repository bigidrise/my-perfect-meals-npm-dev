import crypto from "crypto";
import { db } from "../db";
import { clientNotes, tabletVoiceJobs } from "../db/schema/studio";
import {
  deleteStudioVoiceFromPrivateStorage,
  getStudioVoiceObjectKey,
  type StudioVoiceStorageBackend,
  uploadStudioVoiceToPrivateStorage,
} from "./tabletVoiceService";

export type StudioVoiceDraft = {
  studioId: string;
  clientUserId: string;
  authorUserId: string;
  body: string;
  entryType: "message" | "note";
  visibility: "shared_with_client" | "professional_only";
  sender: "client" | "pro";
  mimeType: string;
};

export type StudioVoiceEntry = {
  id: string;
  body: string;
  authorUserId: string;
  entryType: "message" | "note";
  visibility: "shared_with_client" | "professional_only";
  sender: "client" | "pro";
  audioObjectKey: string;
  createdAt: Date;
};

export type StudioVoiceWriteRepository = {
  createReady: (
    input: StudioVoiceDraft & {
      id: string;
      objectKey: string;
      storageBackend: StudioVoiceStorageBackend;
    },
  ) => Promise<StudioVoiceEntry>;
  createUnavailable: (
    input: StudioVoiceDraft & {
      id: string;
      storageBackend: StudioVoiceStorageBackend;
    },
  ) => Promise<void>;
};

export type StudioVoiceStorageGateway = {
  upload: (buffer: Buffer, mimeType: string, objectKey: string) => Promise<void>;
  delete: (objectKey: string) => Promise<void>;
};

const privateStorage: StudioVoiceStorageGateway = {
  upload: uploadStudioVoiceToPrivateStorage,
  delete: deleteStudioVoiceFromPrivateStorage,
};

const repository: StudioVoiceWriteRepository = {
  async createReady(input) {
    return db.transaction(async (tx) => {
      const [entry] = await tx
        .insert(clientNotes)
        .values({
          id: input.id,
          studioId: input.studioId,
          clientUserId: input.clientUserId,
          authorUserId: input.authorUserId,
          body: input.body,
          noteType: "general",
          visibility: input.visibility,
          entryType: input.entryType,
          sender: input.sender,
          contentType: "voice",
          audioObjectKey: input.objectKey,
          audioStorageBackend: input.storageBackend,
          audioMimeType: input.mimeType,
          transcriptStatus: "pending",
          moderationStatus: "pending",
        })
        .returning({
          id: clientNotes.id,
          body: clientNotes.body,
          authorUserId: clientNotes.authorUserId,
          entryType: clientNotes.entryType,
          visibility: clientNotes.visibility,
          sender: clientNotes.sender,
          audioObjectKey: clientNotes.audioObjectKey,
          createdAt: clientNotes.createdAt,
        });

      await tx.insert(tabletVoiceJobs).values({ noteId: entry.id, status: "pending" });
      return entry as StudioVoiceEntry;
    });
  },

  async createUnavailable(input) {
    await db
      .insert(clientNotes)
      .values({
        id: input.id,
        studioId: input.studioId,
        clientUserId: input.clientUserId,
        authorUserId: input.authorUserId,
        body: "🎤 Voice note (unavailable)",
        noteType: "general",
        visibility: input.visibility,
        entryType: input.entryType,
        sender: input.sender,
        contentType: "voice",
        audioStorageBackend: input.storageBackend,
        audioMimeType: input.mimeType,
        transcriptStatus: "failed",
        moderationStatus: "pending",
      })
      .onConflictDoNothing();
  },
};

export class StudioVoiceSendError extends Error {
  constructor() {
    super("Studio voice message could not be stored");
    this.name = "StudioVoiceSendError";
  }
}

/**
 * Uploads private media first, then atomically persists the note and queue job.
 * A failed persistence/job transaction is compensated by deleting the fresh
 * object before the caller sees a retryable send failure.
 */
export async function createStudioVoiceNote(
  draft: StudioVoiceDraft,
  buffer: Buffer,
  dependencies: {
    repository?: StudioVoiceWriteRepository;
    storage?: StudioVoiceStorageGateway;
    noteId?: string;
  } = {},
): Promise<StudioVoiceEntry> {
  const voiceRepository = dependencies.repository ?? repository;
  const voiceStorage = dependencies.storage ?? privateStorage;
  const id = dependencies.noteId ?? crypto.randomUUID();
  const storageBackend: StudioVoiceStorageBackend = "replit";
  const objectKey = getStudioVoiceObjectKey(id, draft.mimeType);

  try {
    await voiceStorage.upload(buffer, draft.mimeType, objectKey);
  } catch (error) {
    await voiceRepository.createUnavailable({ ...draft, id, storageBackend }).catch(() => undefined);
    throw new StudioVoiceSendError();
  }

  try {
    return await voiceRepository.createReady({
      ...draft,
      id,
      objectKey,
      storageBackend,
    });
  } catch (error) {
    try {
      await voiceStorage.delete(objectKey);
    } catch (cleanupError) {
      console.error("[StudioVoice] Could not clean up failed private upload:", cleanupError);
    }
    await voiceRepository.createUnavailable({ ...draft, id, storageBackend }).catch(() => undefined);
    throw new StudioVoiceSendError();
  }
}

const playbackTokens = new Map<string, { entryId: string; actorUserId: string; expiresAt: number }>();

export function issueStudioVoicePlaybackToken(entryId: string, actorUserId: string): string {
  const token = crypto.randomUUID();
  playbackTokens.set(token, { entryId, actorUserId, expiresAt: Date.now() + 5 * 60 * 1000 });
  return token;
}

export function isValidStudioVoicePlaybackToken(
  token: unknown,
  entryId: string,
  actorUserId: string,
): boolean {
  if (typeof token !== "string") return false;
  const entry = playbackTokens.get(token);
  if (!entry || entry.expiresAt < Date.now()) {
    playbackTokens.delete(token);
    return false;
  }
  return entry.entryId === entryId && entry.actorUserId === actorUserId;
}