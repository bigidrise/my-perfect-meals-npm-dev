jest.mock("../db", () => ({ db: {} }));
jest.mock("../lib/auditLog", () => ({ logAudit: jest.fn() }));
jest.mock("../services/tabletVoiceService", () => ({
  deleteStudioVideoFromS3: jest.fn(),
}));

import { deleteStudioVideoFromS3 } from "../services/tabletVoiceService";
import {
  purgeClaimedStudioVideo,
  purgeExpiredStudioVideos,
  type StudioVideoPurgeDatabase,
  type StudioVideoPurgeRow,
} from "../services/voiceJobWorker";

const NOW = new Date("2026-08-24T12:00:00.000Z");

function makeRow(overrides: Partial<StudioVideoPurgeRow> = {}): StudioVideoPurgeRow {
  return {
    id: "media-1",
    message_id: "message-1",
    studio_id: "studio-1",
    client_user_id: "client-1",
    author_user_id: "pro-1",
    state: "deleting",
    object_key: "studio-video/message-1/original.mp4",
    temporary_derivative_keys: [
      "studio-video/message-1/preview.mp4",
      "studio-video/message-1/thumbnail.jpg",
    ],
    expires_at: new Date("2026-08-23T12:00:00.000Z"),
    watch_completed_at: new Date("2026-08-22T12:00:00.000Z"),
    transcript: "The completed coaching transcript stays with the message.",
    transcript_status: "completed",
    deletion_claim_token: "claim-1",
    ...overrides,
  };
}

function queuedDatabase(
  results: Array<{ rows?: unknown[] }>,
): { database: StudioVideoPurgeDatabase; queries: any[] } {
  const queries: any[] = [];
  return {
    database: {
      execute: async (query: any) => {
        queries.push(query);
        return results.shift() ?? { rows: [] };
      },
    },
    queries,
  };
}

function sqlText(query: any): string {
  return (query?.queryChunks ?? [])
    .map((chunk: any) => typeof chunk === "string" ? chunk : (chunk?.value ?? ""))
    .join("");
}

describe("Studio video purge worker", () => {
  test("clears media references only after every original and derivative is deleted, then stays idempotent", async () => {
    const row = makeRow();
    const { database, queries } = queuedDatabase([
      { rows: [] }, // mark expiration_pending rows as expired
      { rows: [row] }, // claim due media
      { rows: [{ id: row.id }] }, // renew this item's lease
      { rows: [{ id: row.id }] }, // finalize deletion
      { rows: [] }, // second run expires none
      { rows: [] }, // second run claims none
    ]);
    const deletedKeys: string[] = [];
    const storage = {
      deleteObject: async (key: string) => {
        deletedKeys.push(key);
      },
    };

    await expect(purgeExpiredStudioVideos({ database, storage, now: NOW })).resolves.toEqual({
      claimed: 1,
      deleted: 1,
      failed: 0,
    });
    await expect(purgeExpiredStudioVideos({ database, storage, now: NOW })).resolves.toEqual({
      claimed: 0,
      deleted: 0,
      failed: 0,
    });

    expect(deletedKeys).toEqual([
      "studio-video/message-1/original.mp4",
      "studio-video/message-1/preview.mp4",
      "studio-video/message-1/thumbnail.jpg",
    ]);
    expect(sqlText(queries[0])).toContain("studio_video_messages");
    const finalizationSql = sqlText(queries[3]);
    expect(finalizationSql).toContain("object_key = NULL");
    expect(finalizationSql).toContain("temporary_derivative_keys = '[]'::jsonb");
    expect(finalizationSql).toContain("deleted_at = COALESCE");
    expect(finalizationSql).not.toContain("SET transcript");
  });

  test("records a retryable failure after attempting every object in a partial storage outage", async () => {
    const row = makeRow();
    const { database, queries } = queuedDatabase([
      { rows: [{ id: row.id }] }, // renew this item's lease
      { rows: [{ id: row.id }] }, // record retryable failure
    ]);
    const attemptedKeys: string[] = [];

    await expect(purgeClaimedStudioVideo(
      row,
      database,
      {
        deleteObject: async (key) => {
          attemptedKeys.push(key);
          if (key.endsWith("preview.mp4")) {
            throw new Error("storage temporarily unavailable");
          }
        },
      },
      NOW,
    )).resolves.toBe("deletion_failed");

    expect(attemptedKeys).toEqual([
      "studio-video/message-1/original.mp4",
      "studio-video/message-1/preview.mp4",
      "studio-video/message-1/thumbnail.jpg",
    ]);
    const failureSql = sqlText(queries[1]);
    expect(failureSql).toContain("state = 'deletion_failed'");
    expect(failureSql).toContain("last_deletion_error");
    expect(failureSql).not.toMatch(/(?:^|[\s,])expires_at\s*=/);
  });

  test("uses the private Studio object-storage adapter when no test adapter is supplied", async () => {
    const row = makeRow();
    const { database } = queuedDatabase([
      { rows: [] },
      { rows: [row] },
      { rows: [{ id: row.id }] },
      { rows: [{ id: row.id }] },
    ]);

    await expect(purgeExpiredStudioVideos({ database, now: NOW })).resolves.toEqual({
      claimed: 1,
      deleted: 1,
      failed: 0,
    });

    expect(deleteStudioVideoFromS3).toHaveBeenCalledWith("studio-video/message-1/original.mp4");
    expect(deleteStudioVideoFromS3).toHaveBeenCalledWith("studio-video/message-1/preview.mp4");
    expect(deleteStudioVideoFromS3).toHaveBeenCalledWith("studio-video/message-1/thumbnail.jpg");
  });

  test("never deletes storage when the completed transcript is unavailable", async () => {
    const row = makeRow({ transcript: null, transcript_status: "failed" });
    const { database, queries } = queuedDatabase([
      { rows: [{ id: row.id }] }, // renew this item's lease
      { rows: [{ id: row.id }] }, // record transcript failure
    ]);
    const deleteObject = jest.fn();

    await expect(purgeClaimedStudioVideo(
      row,
      database,
      { deleteObject },
      NOW,
    )).resolves.toBe("deletion_failed");

    expect(deleteObject).not.toHaveBeenCalled();
    expect(sqlText(queries[1])).toContain("state = 'deletion_failed'");
  });

  test("does not clear references when the transcript changes during storage deletion", async () => {
    const row = makeRow();
    const { database, queries } = queuedDatabase([
      { rows: [{ id: row.id }] }, // renew this item's lease
      { rows: [] }, // transcript-guarded finalization did not match
      { rows: [{ id: row.id }] }, // record retryable failure while this lease is held
    ]);

    await expect(purgeClaimedStudioVideo(
      row,
      database,
      { deleteObject: async () => undefined },
      NOW,
    )).resolves.toBe("deletion_failed");

    const finalizationSql = sqlText(queries[1]);
    expect(finalizationSql).toContain("message.transcript_status = 'completed'");
    expect(finalizationSql).toContain("message.transcript =");
    expect(finalizationSql).toContain("media.deletion_claim_token =");
    expect(sqlText(queries[2])).toContain("state = 'deletion_failed'");
  });
});