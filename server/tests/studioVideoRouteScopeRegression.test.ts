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
  orderBy: jest.fn(() => mockQuery),
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
const mockGetStudioVideoMessage = jest.fn();
const mockHideStudioMessageForViewer = jest.fn();
let mockClientAccessDenied = false;
const mockClientAccessCheck = jest.fn();

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
    mockClientAccessCheck();
    if (mockClientAccessDenied) return _res.status(403).json({ error: "No active workspace access" });
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
  getStudioVideoMessage: mockGetStudioVideoMessage,
  isValidStudioVideoPlaybackToken: jest.fn(),
  issueStudioVideoPlaybackToken: jest.fn(),
  listStudioVideoMessages: jest.fn(),
}));

jest.mock("../services/studioMessageVisibilityService", () => ({
  hideStudioMessageForViewer: mockHideStudioMessageForViewer,
  isStudioMessageHiddenForViewer: jest.fn(),
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
import { createStudioVoiceNote } from "../services/studioVoiceMessageService";
import { getOrSet } from "../services/queryCache";
import { listStudioVideoMessages } from "../services/studioVideoMessageService";

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
    mockGetStudioVideoMessage.mockReset();
    mockGetStudioVideoMessage.mockResolvedValue(null);
    mockHideStudioMessageForViewer.mockReset();
    mockHideStudioMessageForViewer.mockResolvedValue({ alreadyHidden: false });
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
    "%s hides retained video history for only the requesting viewer",
    async (_actorType, router, prefix, path, actorUserId, clientUserId) => {
      const response = await request(buildApp(router, prefix)).delete(path);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ ok: true, hidden: true, alreadyHidden: false });
      expect(mockHideStudioMessageForViewer).toHaveBeenCalledWith(expect.objectContaining({
        viewerUserId: actorUserId,
        clientUserId,
        studioId: STUDIO_ID,
        messageId: MESSAGE_ID,
        kind: "video_message",
      }));
    },
  );

  it.each([
    ["professional", proTabletRouter, "/api/pro/tablet", `/api/pro/tablet/${CLIENT_ID}/entry/${MESSAGE_ID}`],
    ["client", clientTabletRouter, "/api/client/tablet", `/api/client/tablet/entry/${MESSAGE_ID}`],
  ])(
    "%s normal video trash action hides history instead of invoking global private-media deletion",
    async (_actorType, router, prefix, path) => {
      mockGetStudioVideoMessage.mockResolvedValueOnce({
        id: MESSAGE_ID,
        studioId: STUDIO_ID,
        clientUserId: CLIENT_ID,
      });

      const response = await request(buildApp(router, prefix)).delete(path);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ ok: true, hidden: true, alreadyHidden: false });
      expect(mockHideStudioMessageForViewer).toHaveBeenCalledWith(expect.objectContaining({
        kind: "video_message",
        messageId: MESSAGE_ID,
      }));
    },
  );
});

describe("Development client conversation routing with synthetic data", () => {
  const originalMode = process.env.NODE_ENV;
  const originalDeployment = process.env.REPLIT_DEPLOYMENT;
  beforeEach(() => {
    process.env.NODE_ENV = "development";
    delete process.env.REPLIT_DEPLOYMENT;
    mockClientAccessDenied = false;
    mockClientAccessCheck.mockClear();
    mockDb.select.mockClear();
    mockDb.insert.mockClear();
    mockQuery.values.mockClear();
    mockModeratePrivateStudioContent.mockReturnValue({ allowed: true });
    (createStudioVoiceNote as jest.Mock).mockResolvedValue({ id: MESSAGE_ID, contentType: "voice", sender: "client" });
    (getOrSet as jest.Mock).mockImplementation((_key, _ttl, factory) => factory());
    (listStudioVideoMessages as jest.Mock).mockResolvedValue([]);
    mockDb.execute.mockResolvedValue({ rows: [] } as any);
  });
  afterEach(() => {
    mockClientAccessDenied = false;
    process.env.NODE_ENV = originalMode;
    if (originalDeployment === undefined) delete process.env.REPLIT_DEPLOYMENT;
    else process.env.REPLIT_DEPLOYMENT = originalDeployment;
  });
  function app() {
    const instance = express();
    instance.use(express.json());
    instance.use((req, _res, next) => {
      (req as any).authUser = { id: CLIENT_ID, professionalRole: "business" };
      next();
    });
    instance.use("/api/client/tablet", clientTabletRouter);
    return instance;
  }
  it("saves a text reply to the authorized Studio, not a new role-based lookup", async () => {
    const result = await request(app()).post("/api/client/tablet/message").send({ body: "Synthetic reply" });
    expect(result.status).toBe(201);
    expect(mockClientAccessCheck).toHaveBeenCalledTimes(1);
    expect(mockQuery.values).toHaveBeenCalledWith(expect.objectContaining({
      studioId: STUDIO_ID, clientUserId: CLIENT_ID, sender: "client",
    }));
    // Only notification metadata is looked up after persistence.
    expect(mockDb.select).not.toHaveBeenCalledWith({ id: expect.anything() });
  });
  it("saves a voice reply to that same authorized Studio", async () => {
    const result = await request(app()).post("/api/client/tablet/voice-message")
      .attach("audio", Buffer.from("synthetic audio"), { filename: "reply.webm", contentType: "audio/webm" });
    expect(result.status).toBe(201);
    expect(createStudioVoiceNote).toHaveBeenCalledWith(expect.objectContaining({
      studioId: STUDIO_ID, clientUserId: CLIENT_ID, sender: "client",
    }), expect.any(Buffer));
  });
  it.each(["message", "voice-message", "video-message"])("rejects unauthorized %s before persistence or upload", async route => {
    mockClientAccessDenied = true;
    const result = await request(app()).post(`/api/client/tablet/${route}`).send({ body: "Synthetic reply" });
    expect(result.status).toBe(403);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });
  it("keys the inbox by the authorized Studio and merges existing media", async () => {
    const result = await request(app()).get("/api/client/tablet");
    expect(result.status).toBe(200);
    expect(getOrSet).toHaveBeenCalledWith(`client-tablet:${CLIENT_ID}:studio:${STUDIO_ID}`, expect.any(Number), expect.any(Function));
    expect(listStudioVideoMessages).toHaveBeenCalledWith(STUDIO_ID, CLIENT_ID, CLIENT_ID);
  });
  it("returns synthetic client text, voice and video in the provider's existing client folder", async () => {
    const text = { id: MESSAGE_ID, entryType: "message", sender: "client", contentType: "text", body: "Synthetic reply", createdAt: "2026-10-16T10:00:00Z" };
    const voice = { ...text, id: "synthetic-voice", contentType: "voice", body: "Synthetic voice" };
    const video = { ...text, id: "synthetic-video", contentType: "video" };
    mockQuery.limit
      .mockResolvedValueOnce([{ id: STUDIO_ID }])
      .mockResolvedValueOnce([text, voice]);
    (listStudioVideoMessages as jest.Mock).mockResolvedValue([video]);
    const result = await request(buildApp(proTabletRouter, "/api/pro/tablet")).get(`/api/pro/tablet/${CLIENT_ID}`);
    expect(result.status).toBe(200);
    expect(result.body.messages.map((entry: any) => entry.contentType)).toEqual(["text", "voice", "video"]);
    expect(listStudioVideoMessages).toHaveBeenCalledWith(STUDIO_ID, CLIENT_ID, PRO_ID);
  });
  it("traces a synthetic fresh unread reply without fetching a folder or updating read markers", async () => {
    const log = jest.spyOn(console, "info").mockImplementation(() => {});
    try {
      mockDb.execute.mockClear();
      mockDb.execute.mockResolvedValue({ rows: [{
        clientUserId: CLIENT_ID, unreadCount: 1,
        lastMessageAt: "2026-10-16T10:00:00Z", lastMessageBody: "PRIVATE SYNTHETIC MESSAGE",
      }] } as any);
      const instance = express();
      instance.use((req, _res, next) => {
        (req as any).authUser = { id: PRO_ID };
        next();
      });
      instance.use("/api/pro/tablet", proTabletRouter);
      const result = await request(instance).get("/api/pro/tablet/unread-summary");
      expect(result.status).toBe(200);
      expect(result.body.totalUnread).toBe(1);
      expect(mockDb.execute).toHaveBeenCalledTimes(1);
      expect(mockDb.insert).not.toHaveBeenCalled();
      expect(log).toHaveBeenCalledWith("[ProUnreadTrace]", {
        stage: "server", count: 1, countType: "number",
        clients: 1, cacheHit: false, studioResolved: true,
      });
      expect(JSON.stringify(log.mock.calls)).not.toContain("PRIVATE");
      expect(JSON.stringify(log.mock.calls)).not.toContain(CLIENT_ID);
    } finally {
      log.mockRestore();
    }
  });
});
