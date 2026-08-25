jest.mock("../db", () => ({ db: {} }));
jest.mock("@replit/object-storage", () => ({
  Client: class MockObjectStorageClient {},
}));

import {
  recoverStuckVoiceNotes,
  type VoiceRecoveryDatabase,
} from "../services/voiceJobWorker";

function sqlText(query: any): string {
  return (query?.queryChunks ?? [])
    .map((chunk: any) => typeof chunk === "string" ? chunk : (chunk?.value ?? ""))
    .join("");
}

describe("stuck Studio voice-note recovery", () => {
  test("fails only old processing/orphaned work and preserves a grace period for active transcription", async () => {
    const queries: any[] = [];
    const database: VoiceRecoveryDatabase = {
      execute: async (query) => {
        queries.push(query);
        if (queries.length === 1) return { rows: [{ note_id: "stale-job-note" }] };
        if (queries.length === 2) return { rows: [] };
        return { rows: [{ id: "orphan-note" }, { id: "missing-audio-note" }] };
      },
    };

    await expect(recoverStuckVoiceNotes({
      database,
      now: new Date("2026-08-25T12:00:00.000Z"),
      graceMs: 15 * 60_000,
    })).resolves.toEqual({ staleJobs: 1, recoveredNotes: 2 });

    expect(sqlText(queries[0])).toContain("job.status = 'processing'");
    expect(sqlText(queries[0])).toContain("job.processing_lease_expires_at <=");
    expect(sqlText(queries[0])).not.toContain("job.created_at <");
    expect(sqlText(queries[1])).toContain("note.audio_object_key IS NULL");
    expect(sqlText(queries[2])).toContain("NOT EXISTS");
    expect(sqlText(queries[2])).toContain("job.processing_lease_expires_at >");
    expect(sqlText(queries[2])).toContain("transcript_status = 'failed'");
  });
});