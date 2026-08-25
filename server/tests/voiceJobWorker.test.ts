jest.mock("../db", () => ({ db: {} }));
jest.mock("../lib/auditLog", () => ({ logAudit: jest.fn() }));
jest.mock("../services/tabletVoiceService", () => ({
  deleteStudioVideoFromS3: jest.fn(),
}));

import {
  recoverStuckStudioVoiceNotes,
  shouldRecoverPendingStudioVoiceNote,
  STUDIO_VOICE_RECOVERY_MESSAGE,
  type StudioVoiceRecoveryDatabase,
} from "../services/voiceJobWorker";

const NOW = new Date("2026-08-25T12:00:00.000Z");

function queuedDatabase(result: { rows?: unknown[] }) {
  const queries: any[] = [];
  const database: StudioVoiceRecoveryDatabase = {
    execute: async (query: any) => {
      queries.push(query);
      return result;
    },
  };
  return { database, queries };
}

function sqlText(query: any): string {
  return (query?.queryChunks ?? [])
    .map((chunk: any) => typeof chunk === "string" ? chunk : (chunk?.value ?? ""))
    .join("");
}

describe("Studio voice recovery", () => {
  test("atomically marks both the stale job and note failed without deleting media", async () => {
    const { database, queries } = queuedDatabase({
      rows: [{ id: "missing-audio" }, { id: "missing-job" }],
    });

    await expect(recoverStuckStudioVoiceNotes(database, NOW)).resolves.toEqual({ recovered: 2 });

    const query = sqlText(queries[0]);
    expect(query).toContain("WITH candidates AS");
    expect(query).toContain("failed_jobs AS");
    expect(query).toContain("UPDATE client_notes AS note");
    expect(query).toContain("UPDATE tablet_voice_jobs AS job");
    expect(query).toContain("note.audio_object_key IS NULL");
    expect(query).toContain("BTRIM(note.audio_object_key) = ''");
    expect(query).toContain("job.status = 'pending'");
    expect(query).toContain("job.processing_lease_expires_at <=");
    expect(query).toContain("processing_claim_token = NULL");
    expect(query).toContain("transcript_status = 'failed'");
    expect(query).toContain("body =");
    expect(query).not.toContain("DELETE");
  });

  test("keeps a note pending while its transcription claim lease is active", () => {
    expect(shouldRecoverPendingStudioVoiceNote({
      audioObjectKey: "studio-voice/note-1.webm",
      now: NOW,
      jobs: [{
        status: "processing",
        attempts: 1,
        processingLeaseExpiresAt: new Date("2026-08-25T12:04:00.000Z"),
      }],
    })).toBe(false);
  });

  test("recovers a note after an expired or legacy unleased processing claim", () => {
    expect(shouldRecoverPendingStudioVoiceNote({
      audioObjectKey: "studio-voice/note-2.webm",
      now: NOW,
      jobs: [{
        status: "processing",
        attempts: 1,
        processingLeaseExpiresAt: new Date("2026-08-25T11:59:59.000Z"),
      }],
    })).toBe(true);
    expect(shouldRecoverPendingStudioVoiceNote({
      audioObjectKey: "studio-voice/note-3.webm",
      now: NOW,
      jobs: [{ status: "processing", attempts: 1, processingLeaseExpiresAt: null }],
    })).toBe(true);
  });

  test("recovers missing, exhausted, and unqueued records but not runnable work", () => {
    expect(shouldRecoverPendingStudioVoiceNote({
      audioObjectKey: null,
      now: NOW,
      jobs: [{ status: "pending", attempts: 0 }],
    })).toBe(true);
    expect(shouldRecoverPendingStudioVoiceNote({
      audioObjectKey: "studio-voice/note-4.webm",
      now: NOW,
      jobs: [{ status: "pending", attempts: 3 }],
    })).toBe(true);
    expect(shouldRecoverPendingStudioVoiceNote({
      audioObjectKey: "studio-voice/note-5.webm",
      now: NOW,
      jobs: [],
    })).toBe(true);
    expect(shouldRecoverPendingStudioVoiceNote({
      audioObjectKey: "studio-voice/note-6.webm",
      now: NOW,
      jobs: [{ status: "pending", attempts: 2 }],
    })).toBe(false);
  });

  test("uses a retryable message that tells the user what to do", () => {
    expect(STUDIO_VOICE_RECOVERY_MESSAGE.toLowerCase()).toContain("record");
    expect(STUDIO_VOICE_RECOVERY_MESSAGE.toLowerCase()).toContain("send");
  });
});