jest.mock("../db", () => ({
  db: { execute: jest.fn(async () => ({ rows: [] })) },
}));

import { db } from "../db";
import { runStudioVoiceStorageMigration } from "../db/migrations/runStudioVoiceStorageMigration";

function sqlText(query: any): string {
  return (query?.queryChunks ?? [])
    .map((chunk: any) => typeof chunk === "string" ? chunk : (chunk?.value ?? ""))
    .join("");
}

describe("Studio voice recovery migration", () => {
  test("adds durable processing claims and recovery indexes through the boot migration", async () => {
    await runStudioVoiceStorageMigration();

    const queries = (db.execute as jest.Mock).mock.calls.map(([query]) => sqlText(query));
    expect(queries.join("\n")).toContain("processing_claim_token TEXT");
    expect(queries.join("\n")).toContain("processing_lease_expires_at TIMESTAMPTZ");
    expect(queries.join("\n")).toContain("idx_client_notes_voice_recovery");
    expect(queries.join("\n")).toContain("idx_tablet_voice_jobs_processing_lease");
  });
});
