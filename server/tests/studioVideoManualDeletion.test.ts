jest.mock("../db", () => ({ db: {} }));
jest.mock("../lib/auditLog", () => ({ logAudit: jest.fn() }));
jest.mock("../services/tabletVoiceService", () => ({
  deleteStudioVideoFromS3: jest.fn(),
}));

import {
  deleteStudioVideoMessageMedia,
  isRetryableStudioVideoDeletionFailure,
  type StudioVideoManualDeletionDatabase,
} from "../services/studioVideoMessageService";

function makeRow() {
  return {
    id: "media-1",
    message_id: "message-1",
    object_key: "studio-video/message-1/original.mp4",
    temporary_derivative_keys: [
      "studio-video/message-1/preview.mp4",
      "studio-video/message-1/thumbnail.jpg",
    ],
    transcript: "A completed transcript that remains in history.",
    transcript_status: "completed",
    deletion_claim_token: "claim-1",
  };
}

function makeFailedTranscriptionRow() {
  return {
    ...makeRow(),
    message_id: "message-failed-1",
    object_key: "studio-video/message-failed-1/original.webm",
    temporary_derivative_keys: [],
    transcript: null,
    transcript_status: "failed",
  };
}

function sqlText(query: any): string {
  return (query?.queryChunks ?? [])
    .map((chunk: any) => typeof chunk === "string" ? chunk : (chunk?.value ?? ""))
    .join("");
}

describe("manual Studio video deletion", () => {
  test("classifies persisted storage and finalization failures as retryable route responses", () => {
    expect(
      isRetryableStudioVideoDeletionFailure(new Error("Private video deletion failed")),
    ).toBe(true);
    expect(
      isRetryableStudioVideoDeletionFailure(
        new Error("Video deletion could not be finalized safely"),
      ),
    ).toBe(true);
    expect(
      isRetryableStudioVideoDeletionFailure(
        new Error("Video deletion is already in progress or no longer eligible"),
      ),
    ).toBe(false);
  });

  test("claims media, deletes every private object, and retains the transcript record", async () => {
    const row = makeRow();
    const queries: any[] = [];
    const database: StudioVideoManualDeletionDatabase = {
      execute: async (query) => {
        queries.push(query);
        return queries.length === 1 ? { rows: [row] } : { rows: [{ id: row.id }] };
      },
    };
    const deletedKeys: string[] = [];

    await expect(deleteStudioVideoMessageMedia({
      studioId: "studio-1",
      clientUserId: "client-1",
      messageId: "message-1",
      now: new Date("2026-08-25T12:00:00.000Z"),
    }, {
      database,
      storage: { deleteObject: async (key) => { deletedKeys.push(key); } },
    })).resolves.toBe("deleted");

    expect(deletedKeys).toEqual([
      "studio-video/message-1/original.mp4",
      "studio-video/message-1/preview.mp4",
      "studio-video/message-1/thumbnail.jpg",
    ]);
    expect(sqlText(queries[0])).toContain("media.state IN ('ready', 'expiration_pending', 'deletion_failed', 'transcription_failed')");
    expect(sqlText(queries[0])).toContain("media.state = 'deleting'");
    expect(sqlText(queries[1])).toContain("deletion_lease_expires_at");
    expect(sqlText(queries[2])).toContain("object_key = NULL");
    expect(sqlText(queries[2])).toContain("temporary_derivative_keys = '[]'::jsonb");
    expect(sqlText(queries[2])).not.toContain("SET transcript");
  });

  test("deletes a failed-transcription private video while retaining its failed history record", async () => {
    const row = makeFailedTranscriptionRow();
    const queries: any[] = [];
    const database: StudioVideoManualDeletionDatabase = {
      execute: async (query) => {
        queries.push(query);
        return queries.length === 1 ? { rows: [row] } : { rows: [{ id: row.id }] };
      },
    };
    const deleteObject = jest.fn(async () => {});

    await expect(deleteStudioVideoMessageMedia({
      studioId: "studio-1",
      clientUserId: "client-1",
      messageId: row.message_id,
    }, {
      database,
      storage: { deleteObject },
    })).resolves.toBe("deleted");

    expect(deleteObject).toHaveBeenCalledWith(row.object_key);
    expect(sqlText(queries[0])).toContain("message.transcript_status = 'failed'");
    expect(sqlText(queries[0])).toContain("media.state IN ('transcription_failed', 'deletion_failed')");
    expect(sqlText(queries[2])).not.toContain("SET transcript");
  });

  test("keeps every media reference retryable when any private object cannot be deleted", async () => {
    const row = makeRow();
    const queries: any[] = [];
    const database: StudioVideoManualDeletionDatabase = {
      execute: async (query) => {
        queries.push(query);
        return queries.length <= 2 ? { rows: [row] } : { rows: [] };
      },
    };

    await expect(deleteStudioVideoMessageMedia({
      studioId: "studio-1",
      clientUserId: "client-1",
      messageId: "message-1",
    }, {
      database,
      storage: {
        deleteObject: async (key) => {
          if (key.endsWith("preview.mp4")) throw new Error("temporary outage");
        },
      },
    })).resolves.toBe("deletion_failed");

    expect(sqlText(queries[2])).toContain("state = 'deletion_failed'");
    expect(sqlText(queries[2])).toContain("last_deletion_error");
    expect(sqlText(queries[2])).not.toContain("object_key = NULL");
  });

  test("does not touch storage when the claim is denied by relationship/state guards", async () => {
    const deleteObject = jest.fn();
    const database: StudioVideoManualDeletionDatabase = {
      execute: async () => ({ rows: [] }),
    };

    await expect(deleteStudioVideoMessageMedia({
      studioId: "other-studio",
      clientUserId: "client-1",
      messageId: "message-1",
    }, { database, storage: { deleteObject } })).resolves.toBe("unavailable");

    expect(deleteObject).not.toHaveBeenCalled();
  });

  test("does not finalize after a manual deletion lease is lost during storage work", async () => {
    const row = makeRow();
    const queries: any[] = [];
    const database: StudioVideoManualDeletionDatabase = {
      execute: async (query) => {
        queries.push(query);
        if (queries.length === 1 || queries.length === 2) return { rows: [row] };
        return { rows: [] };
      },
    };

    await expect(deleteStudioVideoMessageMedia({
      studioId: "studio-1",
      clientUserId: "client-1",
      messageId: "message-1",
    }, {
      database,
      heartbeatMs: 1,
      storage: {
        deleteObject: async () => {
          await new Promise((resolve) => setTimeout(resolve, 15));
        },
      },
    })).resolves.toBe("deletion_failed");

    expect(queries.some((query) => sqlText(query).includes("object_key = NULL"))).toBe(false);
    expect(queries.filter((query) => sqlText(query).includes("deletion_lease_expires_at")).length).toBeGreaterThanOrEqual(2);
  });
});