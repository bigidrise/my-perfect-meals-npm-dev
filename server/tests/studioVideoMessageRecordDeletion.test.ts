import type { Request } from "express";

const STUDIO_ID = "00000000-0000-0000-0000-000000000001";
const CLIENT_ID = "00000000-0000-0000-0000-000000000002";
const ACTOR_ID = "00000000-0000-0000-0000-000000000003";
const MESSAGE_ID = "00000000-0000-0000-0000-000000000004";

const mockSelect = jest.fn();
const mockDelete = jest.fn();
const mockLogAudit = jest.fn();
const mockGetClientIp = jest.fn(() => null);

jest.mock("../db", () => ({
  db: {
    select: mockSelect,
    delete: mockDelete,
  },
}));

jest.mock("../lib/auditLog", () => ({
  getClientIp: mockGetClientIp,
  logAudit: mockLogAudit,
}));

jest.mock("../services/tabletVoiceService", () => ({
  deleteStudioVideoFromS3: jest.fn(),
}));

import { deleteStudioVideoMessageRecord } from "../services/studioVideoMessageService";

const request = {
  path: `/studio/${STUDIO_ID}/video/${MESSAGE_ID}/transcript`,
  headers: {},
  ip: "127.0.0.1",
} as unknown as Request;

const terminalRecord = {
  message: {
    id: MESSAGE_ID,
    studioId: STUDIO_ID,
    clientUserId: CLIENT_ID,
    visibility: "shared_with_client",
  },
  media: {
    state: "deleted",
    objectKey: null,
    temporaryDerivativeKeys: [],
    deletedAt: new Date("2026-08-26T12:00:00.000Z"),
  },
};

function configureDatabase() {
  const selectQuery: any = {};
  selectQuery.from = jest.fn(() => selectQuery);
  selectQuery.innerJoin = jest.fn(() => selectQuery);
  selectQuery.where = jest.fn(() => selectQuery);
  selectQuery.limit = jest.fn(async () => [terminalRecord]);
  mockSelect.mockReturnValue(selectQuery);

  const deleteQuery: any = {};
  deleteQuery.where = jest.fn(() => deleteQuery);
  deleteQuery.returning = jest.fn(async () => [{ id: MESSAGE_ID }]);
  mockDelete.mockReturnValue(deleteQuery);
}

describe("Studio video transcript/message deletion", () => {
  beforeEach(() => {
    mockSelect.mockReset();
    mockDelete.mockReset();
    mockLogAudit.mockReset();
    mockGetClientIp.mockReset();
    mockGetClientIp.mockReturnValue(null);
    configureDatabase();
  });

  it("deletes the parent row and records only safe lifecycle metadata", async () => {
    await expect(deleteStudioVideoMessageRecord({
      req: request,
      actorUserId: ACTOR_ID,
      studioId: STUDIO_ID,
      clientUserId: CLIENT_ID,
      messageId: MESSAGE_ID,
    })).resolves.toEqual({ deletedAt: expect.any(String) });

    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: "DELETE",
      resourceType: "studio_video_message",
      resourceId: MESSAGE_ID,
      meta: {
        deletionType: "transcript_message",
        lifecycleState: "deleted",
      },
    }));
    expect(mockLogAudit.mock.calls[0][0].meta).not.toHaveProperty("mediaState");
  });

  it("does not turn a post-delete audit failure into a retryable deletion error", async () => {
    mockLogAudit.mockImplementationOnce(() => {
      throw new Error("audit sink unavailable");
    });
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    await expect(deleteStudioVideoMessageRecord({
      req: request,
      actorUserId: ACTOR_ID,
      studioId: STUDIO_ID,
      clientUserId: CLIENT_ID,
      messageId: MESSAGE_ID,
    })).resolves.toEqual({ deletedAt: expect.any(String) });

    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      "Failed to record Studio video message deletion audit:",
      expect.any(Error),
    );
    errorSpy.mockRestore();
  });
});