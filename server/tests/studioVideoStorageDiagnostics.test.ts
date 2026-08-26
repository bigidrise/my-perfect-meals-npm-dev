const mockExists = jest.fn();
const mockDelete = jest.fn();

jest.mock("@replit/object-storage", () => ({
  Client: jest.fn(() => ({
    exists: mockExists,
    delete: mockDelete,
  })),
}));

import { deleteStudioVideoFromS3 } from "../services/tabletVoiceService";
import {
  getAttachedStudioVideoStorageDeleteDiagnostic,
  getStudioVideoDeletionFailureDiagnostic,
  logStudioVideoDeletionFailure,
  logStudioVideoStorageDeleteFailure,
} from "../services/studioVideoStorageDiagnostics";

describe("Studio video storage delete diagnostics", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    mockExists.mockReset();
    mockDelete.mockReset();
  });

  afterAll(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  test("captures safe DEV metadata without changing the failed delete result", async () => {
    process.env.NODE_ENV = "development";
    const objectKey = "studio-video/private-message.webm";
    mockExists.mockResolvedValue({ ok: true, value: true });
    mockDelete.mockResolvedValue({
      ok: false,
      error: {
        message: `Forbidden: ${objectKey}`,
        statusCode: 403,
        requestId: "gcs-request-123",
      },
    });

    let thrown: unknown;
    try {
      await deleteStudioVideoFromS3(objectKey);
    } catch (error) {
      thrown = error;
    }

    expect(mockExists).toHaveBeenCalledWith(objectKey);
    expect(mockDelete).toHaveBeenCalledWith(objectKey);
    expect(thrown).toBeInstanceOf(Error);
    expect(getAttachedStudioVideoStorageDeleteDiagnostic(thrown)).toEqual({
      sdkErrorClass: "RequestError",
      failureCategory: "permission_denied",
      objectExistedBeforeDelete: true,
      statusCode: 403,
      providerRequestId: "gcs-request-123",
    });
    expect(JSON.stringify(getAttachedStudioVideoStorageDeleteDiagnostic(thrown))).not.toContain(objectKey);
  });

  test("does not run the diagnostic exists probe outside development", async () => {
    process.env.NODE_ENV = "production";
    mockDelete.mockResolvedValue({
      ok: false,
      error: { message: "provider unavailable", statusCode: 503 },
    });

    await expect(deleteStudioVideoFromS3("studio-video/message.webm")).rejects.toThrow(
      "Private video deletion failed",
    );

    expect(mockExists).not.toHaveBeenCalled();
    expect(mockDelete).toHaveBeenCalledWith("studio-video/message.webm");
  });

  test("logs only safe fields in development", () => {
    process.env.NODE_ENV = "development";
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = new Error("Private video deletion failed: studio-video/private-message.webm");
    Object.assign(error, { statusCode: 429, requestId: "req-456" });

    logStudioVideoStorageDeleteFailure(error, false);

    expect(warn).toHaveBeenCalledWith("[StudioVideoStorageDeleteDiagnostic]", {
      sdkErrorClass: "Error",
      failureCategory: "rate_limited",
      objectExistedBeforeDelete: "unknown",
      statusCode: 429,
      providerRequestId: "req-456",
      leaseStatus: "valid",
    });
    expect(JSON.stringify(warn.mock.calls[0][1])).not.toContain("private-message");
    warn.mockRestore();
  });

  test("classifies storage deletion failures separately from finalization guards", () => {
    const objectKey = "studio-video/private-message.webm";
    const storageError = new Error(`Provider rejected ${objectKey}`);
    Object.assign(storageError, { statusCode: 503 });

    const storageDelete = getStudioVideoDeletionFailureDiagnostic({
      failureStage: "storage_delete",
      requestId: "request-123",
      httpOutcome: 502,
      leaseStatus: "valid",
      storageDeletionCompleted: false,
      error: storageError,
    });
    const finalizationGuard = getStudioVideoDeletionFailureDiagnostic({
      failureStage: "finalization_guard",
      requestId: "request-456",
      httpOutcome: 502,
      leaseStatus: "unknown",
      storageDeletionCompleted: true,
    });

    expect(storageDelete).toEqual({
      failureStage: "storage_delete",
      requestId: "request-123",
      httpOutcome: 502,
      leaseStatus: "valid",
      storageDeletionCompleted: false,
      sdkErrorClass: "Error",
      sdkStatus: 503,
    });
    expect(finalizationGuard).toEqual({
      failureStage: "finalization_guard",
      requestId: "request-456",
      httpOutcome: 502,
      leaseStatus: "unknown",
      storageDeletionCompleted: true,
    });
    expect(JSON.stringify(storageDelete)).not.toContain(objectKey);
  });

  test("emits only the sanitized deletion-stage event in development", () => {
    process.env.NODE_ENV = "development";
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);

    logStudioVideoDeletionFailure({
      failureStage: "storage_delete",
      requestId: "request-789",
      httpOutcome: 502,
      leaseStatus: "lost",
      storageDeletionCompleted: true,
      error: Object.assign(new Error("private content"), { statusCode: 429 }),
    });

    expect(warn).toHaveBeenCalledWith("[StudioVideoDeletionDiagnostic]", {
      failureStage: "storage_delete",
      requestId: "request-789",
      httpOutcome: 502,
      leaseStatus: "lost",
      storageDeletionCompleted: true,
      sdkErrorClass: "Error",
      sdkStatus: 429,
    });
    warn.mockRestore();
  });
});