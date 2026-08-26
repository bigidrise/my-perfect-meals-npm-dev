const mockExecute = jest.fn();

jest.mock("../db", () => ({
  db: { execute: mockExecute },
}));

import {
  hideStudioMessageForViewer,
  isStudioMessageHiddenForViewer,
} from "../services/studioMessageVisibilityService";

const scope = {
  studioId: "studio-1",
  clientUserId: "client-1",
  messageId: "message-1",
};

function sqlText(query: any): string {
  return (query?.queryChunks ?? [])
    .map((chunk: any) => typeof chunk === "string" ? chunk : (chunk?.value ?? ""))
    .join("");
}

describe("Studio participant message visibility", () => {
  beforeEach(() => {
    mockExecute.mockReset();
  });

  it("hides a text or voice row for the provider without deleting shared history", async () => {
    mockExecute.mockResolvedValueOnce({ rows: [{ id: "tombstone-1" }] });

    await expect(hideStudioMessageForViewer({
      ...scope,
      viewerUserId: "provider-1",
      kind: "client_note",
    })).resolves.toEqual({ alreadyHidden: false });

    const statement = sqlText(mockExecute.mock.calls[0][0]);
    expect(statement).toContain("INSERT INTO studio_message_viewer_deletions");
    expect(statement).toContain("client_note_id");
    expect(statement).toContain("note.entry_type = 'message'");
    expect(statement).not.toContain("DELETE FROM client_notes");
    expect(statement).not.toContain("DELETE FROM tablet_voice_jobs");
  });

  it("keeps each participant's hidden state independent", async () => {
    mockExecute
      .mockResolvedValueOnce({ rows: [{ id: "provider-tombstone" }] })
      .mockResolvedValueOnce({ rows: [{ id: "client-tombstone" }] });

    await hideStudioMessageForViewer({
      ...scope,
      viewerUserId: "provider-1",
      kind: "client_note",
    });
    await hideStudioMessageForViewer({
      ...scope,
      viewerUserId: "client-1",
      kind: "client_note",
    });

    const providerStatement = sqlText(mockExecute.mock.calls[0][0]);
    const clientStatement = sqlText(mockExecute.mock.calls[1][0]);
    expect(providerStatement).toContain("viewer_user_id");
    expect(clientStatement).toContain("viewer_user_id");
    expect(mockExecute).toHaveBeenCalledTimes(2);
  });

  it("hides retained video transcript history without touching the media lifecycle", async () => {
    mockExecute.mockResolvedValueOnce({ rows: [{ id: "tombstone-video-1" }] });

    await expect(hideStudioMessageForViewer({
      ...scope,
      viewerUserId: "client-1",
      kind: "video_message",
    })).resolves.toEqual({ alreadyHidden: false });

    const statement = sqlText(mockExecute.mock.calls[0][0]);
    expect(statement).toContain("studio_video_message_id");
    expect(statement).toContain("FROM studio_video_messages");
    expect(statement).not.toContain("DELETE FROM studio_video_messages");
    expect(statement).not.toContain("studio_video_media");
  });

  it("allows playback/listing code to distinguish a hidden viewer from the other participant", async () => {
    mockExecute
      .mockResolvedValueOnce({ rows: [{ id: "provider-tombstone" }] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(isStudioMessageHiddenForViewer({
      ...scope,
      viewerUserId: "provider-1",
      kind: "video_message",
    })).resolves.toBe(true);
    await expect(isStudioMessageHiddenForViewer({
      ...scope,
      viewerUserId: "client-1",
      kind: "video_message",
    })).resolves.toBe(false);
  });
});