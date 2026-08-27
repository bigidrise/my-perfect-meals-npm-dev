jest.mock("../db", () => ({ db: {} }));
jest.mock("../lib/auditLog", () => ({ logAudit: jest.fn() }));
jest.mock("../services/tabletVoiceService", () => ({
  deleteStudioVideoFromS3: jest.fn(),
  getStudioVideoObjectKey: jest.fn((messageId: string, mimeType: string) =>
    `studio-video/${messageId}.${mimeType.includes("mp4") ? "mp4" : "webm"}`,
  ),
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
    prior_state: "ready",
    object_key: "studio-video/message-1/original.mp4",
    mime_type: "video/mp4",
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
      { rows: [] }, // recover abandoned manual deletion leases
      { rows: [] }, // mark expiration_pending rows as expired
      { rows: [row] }, // claim due media
      { rows: [{ id: row.id }] }, // renew this item's lease
      { rows: [{ id: row.id }] }, // finalize deletion
      { rows: [] }, // recover abandoned manual deletion leases
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
    expect(sqlText(queries[0])).toContain("deletion_lease_expires_at");
    expect(sqlText(queries[1])).toContain("studio_video_messages");
    const finalizationSql = sqlText(queries[4]);
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

  test("never deletes storage when transcript state is malformed", async () => {
    const row = makeRow({ transcript: "unexpected transcript", transcript_status: "failed" });
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

  test("deletes unopened media after its retention deadline while keeping a completed transcript", async () => {
    const row = makeRow({
      watch_completed_at: null,
      expires_at: new Date("2026-08-23T12:00:00.000Z"),
    });
    const { database, queries } = queuedDatabase([
      { rows: [{ id: row.id }] }, // renew this item's lease
      { rows: [{ id: row.id }] }, // finalize deletion
    ]);
    const deletedKeys: string[] = [];

    await expect(purgeClaimedStudioVideo(
      row,
      database,
      { deleteObject: async (key) => { deletedKeys.push(key); } },
      NOW,
    )).resolves.toBe("deleted");

    expect(deletedKeys).toEqual([
      "studio-video/message-1/original.mp4",
      "studio-video/message-1/preview.mp4",
      "studio-video/message-1/thumbnail.jpg",
    ]);
    expect(sqlText(queries[1])).toContain("object_key = NULL");
    expect(sqlText(queries[1])).not.toContain("SET transcript");
  });

  test("recovers a private object stranded between upload storage and database persistence", async () => {
    const row = makeRow({
      prior_state: "uploading",
      object_key: null,
      temporary_derivative_keys: [],
      transcript: null,
      transcript_status: "failed",
      watch_completed_at: null,
    });
    const { database } = queuedDatabase([
      { rows: [{ id: row.id }] }, // renew this item's lease
      { rows: [{ id: row.id }] }, // finalize deletion
    ]);
    const deletedKeys: string[] = [];

    await expect(purgeClaimedStudioVideo(
      row,
      database,
      { deleteObject: async (key) => { deletedKeys.push(key); } },
      NOW,
    )).resolves.toBe("deleted");

    expect(deletedKeys).toEqual(["studio-video/message-1.mp4"]);
  });

  test("retries a recovered upload key after a transient storage failure", async () => {
    const failedRow = makeRow({
      prior_state: "uploading",
      object_key: null,
      temporary_derivative_keys: [],
      transcript: null,
      transcript_status: "failed",
      watch_completed_at: null,
    });
    const failedAttempt = queuedDatabase([
      { rows: [{ id: failedRow.id }] }, // renew this item's lease
      { rows: [{ id: failedRow.id }] }, // record retryable failure
    ]);
    await expect(purgeClaimedStudioVideo(
      failedRow,
      failedAttempt.database,
      { deleteObject: async () => { throw new Error("temporary storage outage"); } },
      NOW,
    )).resolves.toBe("deletion_failed");

    const retryRow = { ...failedRow, prior_state: "deletion_failed" };
    const retryAttempt = queuedDatabase([
      { rows: [{ id: retryRow.id }] }, // renew this item's lease
      { rows: [{ id: retryRow.id }] }, // finalize deletion
    ]);
    const deletedKeys: string[] = [];
    await expect(purgeClaimedStudioVideo(
      retryRow,
      retryAttempt.database,
      { deleteObject: async (key) => { deletedKeys.push(key); } },
      NOW,
    )).resolves.toBe("deleted");

    expect(deletedKeys).toEqual(["studio-video/message-1.mp4"]);
  });

  test("selects both watched-grace and unopened-retention deadlines for automatic expiration", async () => {
    const { database, queries } = queuedDatabase([
      { rows: [] }, // recover abandoned deletion leases
      { rows: [] }, // expire completed or unopened media
      { rows: [] }, // claim due media
    ]);

    await purgeExpiredStudioVideos({ database, now: NOW });

    const expirationSql = sqlText(queries[1]);
    expect(expirationSql).toContain("media.state = 'expiration_pending'");
    expect(expirationSql).toContain("'ready'");
    expect(expirationSql).toContain("'uploading'");
    expect(expirationSql).toContain("media.created_at");
    expect(expirationSql).toContain("media.watch_completed_at");
  });

  test("recovers a crashed manual deletion claim even when the video was never due for automatic expiry", async () => {
    const { database, queries } = queuedDatabase([
      { rows: [{ id: "ready-media" }] }, // lease recovery
      { rows: [] }, // expiration advance
      { rows: [] }, // due automatic claim
    ]);

    await expect(purgeExpiredStudioVideos({ database, now: NOW })).resolves.toEqual({
      claimed: 0,
      deleted: 0,
      failed: 0,
    });

    const recoverySql = sqlText(queries[0]);
    expect(recoverySql).toContain("state = 'deletion_failed'");
    expect(recoverySql).toContain("state = 'deleting'");
    expect(recoverySql).not.toMatch(/(?:^|[\s(])expires_at\s*<=/);
    expect(recoverySql).not.toContain("object_key = NULL");
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