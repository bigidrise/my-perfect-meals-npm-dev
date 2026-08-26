import express from "express";
import request from "supertest";

const STUDIO_ID = "00000000-0000-0000-0000-000000000001";
const PRO_ID = "00000000-0000-0000-0000-000000000002";
const CLIENT_ID = "00000000-0000-0000-0000-000000000003";
const MESSAGE_ID = "00000000-0000-0000-0000-000000000004";

const mockQuery = {
  from: jest.fn(() => mockQuery),
  where: jest.fn(() => mockQuery),
  limit: jest.fn(async () => [{ id: STUDIO_ID, ownerUserId: PRO_ID }]),
  values: jest.fn(() => mockQuery),
  returning: jest.fn(async () => [{ id: MESSAGE_ID, createdAt: new Date("2026-08-25T12:00:00.000Z") }]),
  set: jest.fn(() => mockQuery),
};

const mockDb = {
  select: jest.fn(() => mockQuery),
  insert: jest.fn(() => mockQuery),
  update: jest.fn(() => mockQuery),
  execute: jest.fn(async () => undefined),
};

const mockTranscribeStudioVideoBuffer = jest.fn();
const mockUploadStudioVideoToS3 = jest.fn(async () => undefined);
const mockModeratePrivateStudioContent = jest.fn(() => ({ allowed: true }));
const mockAuditStudioVideoAction = jest.fn();
const mockDeleteStudioVideoMessageRecord = jest.fn();

jest.mock("../db", () => ({ db: mockDb }));

jest.mock("../middleware/requireWorkspaceAccess", () => ({
  requireWorkspaceAccess: (_req: any, _res: any, next: any) => {
    _req.authUser = {
      id: PRO_ID,
      organizationId: null,
      role: "client",
      professionalRole: "trainer",
    };
    next();
  },
  requireClientWorkspaceAccess: (req: any, _res: any, next: any) => {
    req.authUser = {
      id: CLIENT_ID,
      organizationId: null,
      role: "client",
    };
    req.workspace = { studioId: STUDIO_ID };
    next();
  },
}));

jest.mock("../services/tabletVoiceService", () => ({
  MAX_VOICE_DURATION_SEC: 300,
  MAX_STUDIO_VIDEO_DURATION_SEC: 300,
  MAX_STUDIO_VIDEO_SIZE_BYTES: 64 * 1024 * 1024,
  getSignedPlaybackUrl: jest.fn(),
  getStudioVoiceStream: jest.fn(),
  getStudioVideoStream: jest.fn(),
  getStudioVideoObjectKey: jest.fn(() => "studio-video/test.webm"),
  normalizeVoiceMimeType: jest.fn(() => "audio/webm"),
  resolveVoiceStorageBackend: jest.fn(),
  transcribeStudioVideoBuffer: mockTranscribeStudioVideoBuffer,
  uploadStudioVideoToS3: mockUploadStudioVideoToS3,
}));

jest.mock("../services/studioVideoMessageService", () => ({
  assertStudioVideoFeatureEnabled: jest.fn(),
  auditStudioVideoAction: mockAuditStudioVideoAction,
  auditStudioVideoListAction: jest.fn(),
  deleteStudioVideoMessage: jest.fn(),
  deleteStudioVideoMessageRecord: mockDeleteStudioVideoMessageRecord,
  getStudioVideoMessage: jest.fn(),
  isValidStudioVideoPlaybackToken: jest.fn(),
  issueStudioVideoPlaybackToken: jest.fn(),
  listStudioVideoMessages: jest.fn(),
}));

jest.mock("../services/studioVoiceMessageService", () => ({
  createStudioVoiceNote: jest.fn(),
  isValidStudioVoicePlaybackToken: jest.fn(),
  issueStudioVoicePlaybackToken: jest.fn(),
}));

jest.mock("../services/voiceJobWorker", () => ({
  startVoiceJobWorker: jest.fn(),
}));

jest.mock("../services/tabletModerationService", () => ({
  BLOCKED_MESSAGE: "blocked",
  moderatePrivateStudioContent: mockModeratePrivateStudioContent,
}));

jest.mock("../services/tabletNotificationService", () => ({
  notifyClientOfMessage: jest.fn(),
  notifyClientOfNote: jest.fn(),
  notifyProfessionalOfMessage: jest.fn(),
}));

jest.mock("../services/activityLog", () => ({
  logClientActivity: jest.fn(),
}));

jest.mock("../services/queryCache", () => ({
  getOrSet: jest.fn(),
  invalidateClientTabletCache: jest.fn(),
  invalidatePrefix: jest.fn(),
}));

jest.mock("../services/emailService", () => ({
  sendCoachMessageAlert: jest.fn(),
}));

jest.mock("../lib/auditLog", () => ({
  getClientIp: jest.fn(() => null),
  logAudit: jest.fn(),
}));

import proTabletRouter from "../routes/proTabletRoutes";
import clientTabletRouter from "../routes/clientTabletRoutes";

function buildApp(router: any, prefix: string) {
  const app = express();
  app.use(prefix, router);
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  });
  return app;
}

describe("Studio video route transcript scope regression", () => {
  beforeEach(() => {
    mockDb.select.mockClear();
    mockDb.insert.mockClear();
    mockDb.update.mockClear();
    mockQuery.set.mockClear();
    mockQuery.values.mockClear();
    mockQuery.returning.mockClear();
    mockTranscribeStudioVideoBuffer.mockReset();
    mockTranscribeStudioVideoBuffer.mockResolvedValue({
      transcript: "A safe Studio transcript",
      durationSec: 6,
    });
    mockUploadStudioVideoToS3.mockClear();
    mockModeratePrivateStudioContent.mockReset();
    mockModeratePrivateStudioContent.mockReturnValue({ allowed: true, severity: null, category: null, reason: null });
    mockAuditStudioVideoAction.mockClear();
    mockDeleteStudioVideoMessageRecord.mockReset();
    mockDeleteStudioVideoMessageRecord.mockResolvedValue({
      deletedAt: "2026-08-26T12:00:00.000Z",
    });
  });

  it("professional-to-client saves the transcript, reaches ready, and returns 201", async () => {
    const response = await request(buildApp(proTabletRouter, "/api/pro/tablet"))
      .post(`/api/pro/tablet/${CLIENT_ID}/video-message`)
      .field("durationSec", "6")
      .attach("video", Buffer.from("webm-video"), {
        filename: "studio-video.webm",
        contentType: "video/webm",
      });

    expect(response.status).toBe(201);
    expect(response.body.entry).toEqual(expect.objectContaining({
      id: MESSAGE_ID,
      transcript: "A safe Studio transcript",
      videoTranscriptStatus: "completed",
      videoMediaState: "ready",
    }));
    expect(mockTranscribeStudioVideoBuffer).toHaveBeenCalledWith(
      expect.any(Buffer),
      "video/webm",
    );
    expect(mockQuery.set.mock.calls).toEqual(expect.arrayContaining([
      [expect.objectContaining({
        transcript: "A safe Studio transcript",
        transcriptStatus: "completed",
      })],
      [expect.objectContaining({ state: "ready" })],
    ]));
  });

  it("client-to-professional saves the transcript, reaches ready, and returns 201", async () => {
    const response = await request(buildApp(clientTabletRouter, "/api/client/tablet"))
      .post("/api/client/tablet/video-message")
      .field("durationSec", "6")
      .attach("video", Buffer.from("webm-video"), {
        filename: "studio-video.webm",
        contentType: "video/webm",
      });

    expect(response.status).toBe(201);
    expect(response.body.entry).toEqual(expect.objectContaining({
      id: MESSAGE_ID,
      transcript: "A safe Studio transcript",
      videoTranscriptStatus: "completed",
      videoMediaState: "ready",
    }));
    expect(mockTranscribeStudioVideoBuffer).toHaveBeenCalledWith(
      expect.any(Buffer),
      "video/webm",
    );
    expect(mockQuery.set.mock.calls).toEqual(expect.arrayContaining([
      [expect.objectContaining({
        transcript: "A safe Studio transcript",
        transcriptStatus: "completed",
      })],
      [expect.objectContaining({ state: "ready" })],
    ]));
  });

  it("delivers a profanity-flagged client video with its verbatim transcript intact", async () => {
    const transcript = "This is shit, but the rest of this private message is professional.";
    mockTranscribeStudioVideoBuffer.mockResolvedValue({ transcript, durationSec: 6 });
    mockModeratePrivateStudioContent.mockReturnValue({
      allowed: true,
      severity: "medium",
      category: "abusive_language",
      reason: "inappropriate language",
    });

    const response = await request(buildApp(clientTabletRouter, "/api/client/tablet"))
      .post("/api/client/tablet/video-message")
      .field("durationSec", "6")
      .attach("video", Buffer.from("webm-video"), {
        filename: "studio-video.webm",
        contentType: "video/webm",
      });

    expect(response.status).toBe(201);
    expect(response.body.entry).toEqual(expect.objectContaining({
      transcript,
      videoTranscriptStatus: "completed",
      videoMediaState: "ready",
    }));
    expect(mockModeratePrivateStudioContent).toHaveBeenCalledWith(transcript);
    expect(mockAuditStudioVideoAction).toHaveBeenCalledWith(expect.objectContaining({
      event: "moderation_completed",
      metadata: expect.objectContaining({
        approved: true,
        flagged: true,
        severity: "medium",
        category: "abusive_language",
      }),
    }));
  });

  it.each([
    ["professional", proTabletRouter, "/api/pro/tablet", `/api/pro/tablet/${CLIENT_ID}/video-message`],
    ["client", clientTabletRouter, "/api/client/tablet", "/api/client/tablet/video-message"],
  ])(
    "%s can send a five-minute video larger than the former 24 MiB ceiling",
    async (_sender, router, prefix, path) => {
      const legacyLimitExceededVideo = Buffer.alloc(24 * 1024 * 1024 + 1, 1);
      const response = await request(buildApp(router, prefix))
        .post(path)
        .field("durationSec", "300")
        .attach("video", legacyLimitExceededVideo, {
          filename: "five-minute-studio-video.webm",
          contentType: "video/webm",
        });

      expect(response.status).toBe(201);
      expect(response.body.entry).toEqual(expect.objectContaining({
        videoDurationSec: 300,
        videoMediaState: "ready",
      }));
      expect(mockUploadStudioVideoToS3).toHaveBeenCalledWith(
        expect.any(Buffer),
        "video/webm",
        "studio-video/test.webm",
      );
      expect(mockTranscribeStudioVideoBuffer).toHaveBeenCalledWith(
        expect.any(Buffer),
        "video/webm",
      );
    },
  );

  it.each([
    ["professional", proTabletRouter, "/api/pro/tablet", `/api/pro/tablet/${CLIENT_ID}/video/${MESSAGE_ID}/transcript`, PRO_ID, CLIENT_ID],
    ["client", clientTabletRouter, "/api/client/tablet", `/api/client/tablet/video/${MESSAGE_ID}/transcript`, CLIENT_ID, CLIENT_ID],
  ])(
    "%s can remove a completed transcript/message only through the dedicated endpoint",
    async (_actorType, router, prefix, path, actorUserId, clientUserId) => {
      const response = await request(buildApp(router, prefix)).delete(path);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ ok: true, deleted: true });
      expect(mockDeleteStudioVideoMessageRecord).toHaveBeenCalledWith(expect.objectContaining({
        actorUserId,
        clientUserId,
        studioId: STUDIO_ID,
        messageId: MESSAGE_ID,
      }));
    },
  );

  it("does not report a transcript/message as deleted before private media deletion completes", async () => {
    mockDeleteStudioVideoMessageRecord.mockRejectedValueOnce(
      new Error("Transcript/message deletion is available only after private video media is fully deleted"),
    );

    const response = await request(buildApp(clientTabletRouter, "/api/client/tablet"))
      .delete(`/api/client/tablet/video/${MESSAGE_ID}/transcript`);

    expect(response.status).toBe(409);
    expect(response.body.error).toContain("only after the private video is fully deleted");
  });
});