jest.mock("../db", () => ({ db: {} }));
jest.mock("@replit/object-storage", () => ({
  Client: class MockObjectStorageClient {},
}));

import {
  createStudioVoiceNote,
  isValidStudioVoicePlaybackToken,
  issueStudioVoicePlaybackToken,
  type StudioVoiceDraft,
} from "../services/studioVoiceMessageService";
import {
  normalizeVoiceMimeType,
  resolveVoiceStorageBackend,
} from "../services/tabletVoiceService";

const draft: StudioVoiceDraft = {
  studioId: "studio-1",
  clientUserId: "client-1",
  authorUserId: "pro-1",
  body: "🎤 Voice note — transcribing…",
  entryType: "message",
  visibility: "shared_with_client",
  sender: "pro",
  mimeType: "audio/webm",
};

function entry() {
  return {
    id: "voice-1",
    body: draft.body,
    authorUserId: draft.authorUserId,
    entryType: draft.entryType,
    visibility: draft.visibility,
    sender: draft.sender,
    audioObjectKey: "studio-voice/voice-1.webm",
    createdAt: new Date("2026-08-25T00:00:00.000Z"),
  };
}

describe("Studio voice private storage", () => {
  test("normalizes browser and Capacitor MIME values without accepting an unknown format", () => {
    expect(normalizeVoiceMimeType("audio/webm;codecs=opus")).toBe("audio/webm");
    expect(normalizeVoiceMimeType("audio/mp4; codecs=mp4a.40.2")).toBe("audio/mp4");
    expect(normalizeVoiceMimeType("audio/x-m4a")).toBe("audio/x-m4a");
    expect(normalizeVoiceMimeType("audio/aac")).toBe("audio/aac");
    expect(normalizeVoiceMimeType("audio/unknown")).toBeNull();
  });

  test("writes a new voice note privately before queue persistence and records the Replit backend", async () => {
    const calls: string[] = [];
    const createReady = jest.fn(async () => {
      calls.push("queue");
      return entry();
    });
    const upload = jest.fn(async () => {
      calls.push("upload");
    });

    await expect(createStudioVoiceNote(draft, Buffer.from("audio"), {
      noteId: "voice-1",
      repository: { createReady, createUnavailable: jest.fn() },
      storage: { upload, delete: jest.fn() },
    })).resolves.toEqual(entry());

    expect(calls).toEqual(["upload", "queue"]);
    expect(createReady).toHaveBeenCalledWith(expect.objectContaining({
      id: "voice-1",
      objectKey: "studio-voice/voice-1.webm",
      storageBackend: "replit",
    }));
  });

  test("records a failed/unavailable note without queueing when private storage fails", async () => {
    const createReady = jest.fn();
    const createUnavailable = jest.fn(async () => undefined);

    await expect(createStudioVoiceNote(draft, Buffer.from("audio"), {
      noteId: "voice-2",
      repository: { createReady, createUnavailable },
      storage: {
        upload: async () => { throw new Error("private storage unavailable"); },
        delete: jest.fn(),
      },
    })).rejects.toThrow("Studio voice message could not be stored");

    expect(createReady).not.toHaveBeenCalled();
    expect(createUnavailable).toHaveBeenCalledWith(expect.objectContaining({
      id: "voice-2",
      storageBackend: "replit",
    }));
  });

  test("cleans up the private object and records failure if note/job persistence fails", async () => {
    const deleted: string[] = [];
    const createUnavailable = jest.fn(async () => undefined);

    await expect(createStudioVoiceNote(draft, Buffer.from("audio"), {
      noteId: "voice-3",
      repository: {
        createReady: async () => { throw new Error("job insert failed"); },
        createUnavailable,
      },
      storage: {
        upload: async () => undefined,
        delete: async (key) => { deleted.push(key); },
      },
    })).rejects.toThrow("Studio voice message could not be stored");

    expect(deleted).toEqual(["studio-voice/voice-3.webm"]);
    expect(createUnavailable).toHaveBeenCalledWith(expect.objectContaining({ id: "voice-3" }));
  });

  test("distinguishes legacy S3 records from new private records without inferring from object keys", () => {
    expect(resolveVoiceStorageBackend("replit")).toBe("replit");
    expect(resolveVoiceStorageBackend("s3_legacy")).toBe("s3_legacy");
    expect(resolveVoiceStorageBackend(null)).toBe("s3_legacy");
  });

  test("binds private playback authorization to the authenticated Studio actor", () => {
    const token = issueStudioVoicePlaybackToken("voice-4", "pro-1");
    expect(isValidStudioVoicePlaybackToken(token, "voice-4", "pro-1")).toBe(true);
    expect(isValidStudioVoicePlaybackToken(token, "voice-4", "other-pro")).toBe(false);
    expect(isValidStudioVoicePlaybackToken(token, "other-note", "pro-1")).toBe(false);
  });
});