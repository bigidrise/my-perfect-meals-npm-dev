import { isSafeStudioVideoAuditMetadata } from "@shared/studioVideoMessages";
import { getStudioVideoTranscriptionFailureMetadata } from "../services/studioVideoTranscriptionDiagnostics";

describe("Studio video transcription diagnostics", () => {
  it("retains safe rate-limit diagnostics without provider messages or media content", () => {
    const error = Object.assign(
      new Error("The client transcript and raw video bytes must never enter audit metadata"),
      {
        name: "APIStatusError",
        status: 429,
        request_id: "req_safe_123",
        type: "rate_limit_error",
      },
    );

    const metadata = getStudioVideoTranscriptionFailureMetadata(error);

    expect(metadata).toEqual({
      provider: "openai",
      failureCategory: "rate_limit",
      sdkErrorClass: "APIStatusError",
      httpStatus: 429,
      providerRequestId: "req_safe_123",
      providerErrorType: "rate_limit_error",
    });
    expect(isSafeStudioVideoAuditMetadata(metadata)).toBe(true);
    expect(JSON.stringify(metadata)).not.toContain("transcript");
    expect(JSON.stringify(metadata)).not.toContain("video bytes");
  });

  it("normalizes timeout and ignores unsafe request identifiers", () => {
    const error = Object.assign(new Error("request content must not be recorded"), {
      name: "APITimeoutError",
      request_id: "unsafe request id with spaces",
    });

    expect(getStudioVideoTranscriptionFailureMetadata(error)).toEqual({
      provider: "openai",
      failureCategory: "timeout",
      sdkErrorClass: "APITimeoutError",
    });
  });
});