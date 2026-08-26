import {
  STUDIO_VIDEO_EXPIRATION_WINDOW_MS,
  assertPrivateStudioVideoStorage,
  assertStudioVideoManualDeletionEligible,
  assertStudioVideoMessageDeletionEligible,
  assertStudioVideoMessagesEnabled,
  assertStudioVideoReadyForPlayback,
  assertStudioVideoTransition,
  assertStudioVideoTranscriptRetainable,
  canReplayStudioVideo,
  completeStudioVideoWatch,
  createStudioVideoAuditEvent,
  createVerifiedWatchProgress,
  evaluateStudioVideoAccess,
  finalizeStudioVideoManualDeletion,
  finalizeStudioVideoDeletion,
  getVerifiedWatchSummary,
  recordVerifiedWatchProgress,
  type StudioVideoMediaState,
  type VerifiedWatchProgress,
} from "@shared/studioVideoMessages";

const BASE_TIME = Date.parse("2026-08-24T12:00:00.000Z");

function makeProgressThrough(
  segments: Array<[number, number]>,
): VerifiedWatchProgress {
  let progress = createVerifiedWatchProgress(100);
  let sampleTime = BASE_TIME;

  for (const [start, end] of segments) {
    progress = recordVerifiedWatchProgress(progress, {
      durationSec: 100,
      positionSec: start,
      observedAtMs: sampleTime,
      isPlaying: true,
    }).progress;
    sampleTime += (end - start) * 1000;
    progress = recordVerifiedWatchProgress(progress, {
      durationSec: 100,
      positionSec: end,
      observedAtMs: sampleTime,
      isPlaying: true,
    }).progress;
    sampleTime += 1000;
  }

  return progress;
}

describe("Studio Video Messages — feature gate and contract", () => {
  it("fails closed when the feature flag is missing or false", () => {
    expect(() => assertStudioVideoMessagesEnabled(undefined)).toThrow(
      "STUDIO_VIDEO_MESSAGES_DISABLED",
    );
    expect(() => assertStudioVideoMessagesEnabled(false)).toThrow(
      "STUDIO_VIDEO_MESSAGES_DISABLED",
    );
    expect(() => assertStudioVideoMessagesEnabled(true)).not.toThrow();
  });

  it("requires private, signed, non-cacheable media storage", () => {
    expect(() =>
      assertPrivateStudioVideoStorage({
        isPrivate: true,
        publicUrlAllowed: false,
        signedPlaybackRequired: true,
        cacheControl: "no-store",
      }),
    ).not.toThrow();

    expect(() =>
      assertPrivateStudioVideoStorage({
        isPrivate: false,
        publicUrlAllowed: false,
        signedPlaybackRequired: true,
        cacheControl: "no-store",
      }),
    ).toThrow("VIDEO_STORAGE_NOT_PRIVATE");
  });
});

describe("Studio Video Messages — transcript/message deletion guard", () => {
  const fullyDeletedMedia = {
    state: "deleted" as const,
    objectKey: null,
    temporaryDerivativeKeys: [],
    deletedAt: "2026-08-26T12:00:00.000Z",
  };

  it("allows transcript/message deletion only after private media is fully removed", () => {
    expect(() => assertStudioVideoMessageDeletionEligible(fullyDeletedMedia)).not.toThrow();
  });

  it.each([
    [{ ...fullyDeletedMedia, state: "ready" as const }],
    [{ ...fullyDeletedMedia, objectKey: "studio-video/message.webm" }],
    [{ ...fullyDeletedMedia, temporaryDerivativeKeys: ["studio-video/message.audio.webm"] }],
    [{ ...fullyDeletedMedia, deletedAt: null }],
  ])("rejects deletion until every media reference is gone", (media) => {
    expect(() => assertStudioVideoMessageDeletionEligible(media)).toThrow(
      "VIDEO_MANUAL_DELETION_NOT_ALLOWED",
    );
  });
});

describe("Studio Video Messages — lifecycle transitions", () => {
  const validTransition = (
    currentState: StudioVideoMediaState,
    nextState: StudioVideoMediaState,
    extra: Partial<Parameters<typeof assertStudioVideoTransition>[0]> = {},
  ) =>
    assertStudioVideoTransition({
      currentState,
      nextState,
      now: BASE_TIME,
      ...extra,
    });

  it("allows the upload and processing path to reach ready", () => {
    expect(() => validTransition("draft", "uploading")).not.toThrow();
    expect(() => validTransition("uploading", "uploaded")).not.toThrow();
    expect(() => validTransition("uploaded", "processing")).not.toThrow();
    expect(() => validTransition("processing", "ready")).not.toThrow();
  });

  it("models upload, transcription, moderation, and deletion failures as retryable boundaries", () => {
    expect(() => validTransition("uploading", "upload_failed")).not.toThrow();
    expect(() => validTransition("upload_failed", "uploading")).not.toThrow();
    expect(() =>
      validTransition("processing", "transcription_failed"),
    ).not.toThrow();
    expect(() =>
      validTransition("transcription_failed", "processing"),
    ).not.toThrow();
    expect(() =>
      validTransition("processing", "moderation_failed"),
    ).not.toThrow();
    expect(() =>
      validTransition("moderation_failed", "processing"),
    ).not.toThrow();
    expect(() =>
      validTransition("deletion_failed", "deleting"),
    ).not.toThrow();
  });

  it("allows an eligible participant to begin a manual deletion without changing automatic expiry rules", () => {
    expect(() => validTransition("ready", "deleting")).not.toThrow();
    expect(() => validTransition("expiration_pending", "deleting")).not.toThrow();
    expect(() => validTransition("transcription_failed", "deleting")).not.toThrow();
  });

  it("rejects skipping states or expiring before the 24-hour deadline", () => {
    expect(() => validTransition("draft", "ready")).toThrow(
      "INVALID_STUDIO_VIDEO_TRANSITION",
    );
    expect(() =>
      validTransition("expiration_pending", "expired", {
        expiresAt: new Date(BASE_TIME + 1000).toISOString(),
      }),
    ).toThrow("VIDEO_EXPIRATION_NOT_REACHED");
    expect(() =>
      validTransition("expiration_pending", "expired", {
        now: BASE_TIME + 1000,
        expiresAt: new Date(BASE_TIME + 1000).toISOString(),
      }),
    ).not.toThrow();
  });
});

describe("Studio Video Messages — verified watch completion", () => {
  it("does not complete on open, start, pause, or partial playback", () => {
    const progress = makeProgressThrough([
      [0, 60],
      [60, 98],
    ]);
    expect(getVerifiedWatchSummary(progress).watchedSeconds).toBeCloseTo(98);
    expect(progress.watchedIntervals).toEqual([[0, 98]]);
  });

  it("starts the exact 24-hour countdown only after verified completion", () => {
    let progress = makeProgressThrough([
      [0, 60],
      [60, 98],
    ]);
    progress = recordVerifiedWatchProgress(progress, {
      durationSec: 100,
      positionSec: 0,
      observedAtMs: BASE_TIME,
      isPlaying: true,
    }).progress;

    const result = recordVerifiedWatchProgress(progress, {
      durationSec: 100,
      positionSec: 99,
      observedAtMs: BASE_TIME + 100,
      isPlaying: true,
    });

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("non_monotonic_sample");
    expect(result.progress.watchedIntervals).toEqual([[0, 98]]);
    expect(result.complete).toBe(true);
  });

  it("counts unique verified playback and requires near-end progress", () => {
    const almostComplete = makeProgressThrough([
      [0, 60],
      [60, 95],
      [95, 98],
    ]);
    const summary = getVerifiedWatchSummary(almostComplete);
    expect(summary.coverageRatio).toBeCloseTo(0.98);
    expect(summary.nearEndReached).toBe(true);
    expect(summary.complete).toBe(true);

    const watchedEnoughButNeverNearEnd = makeProgressThrough([[0, 96]]);
    expect(getVerifiedWatchSummary(watchedEnoughButNeverNearEnd).complete).toBe(
      false,
    );
  });

  it("does not double-count replayed intervals", () => {
    const progress = makeProgressThrough([
      [0, 60],
      [60, 98],
    ]);
    expect(getVerifiedWatchSummary(progress).watchedSeconds).toBeCloseTo(98);
    expect(progress.watchedIntervals).toEqual([[0, 98]]);
  });

  it("starts the exact 24-hour countdown only after verified completion", () => {
    const progress = makeProgressThrough([
      [0, 60],
      [60, 98],
    ]);
    const completed = completeStudioVideoWatch({
      currentState: "ready",
      progress,
      completedAt: BASE_TIME,
    });

    expect(completed.state).toBe("expiration_pending");
    expect(Date.parse(completed.expiresAt) - Date.parse(completed.watchCompletedAt)).toBe(
      STUDIO_VIDEO_EXPIRATION_WINDOW_MS,
    );
  });

  it("allows replay during the countdown but not at or after expiration", () => {
    const expiresAt = new Date(
      BASE_TIME + STUDIO_VIDEO_EXPIRATION_WINDOW_MS,
    ).toISOString();
    const media = {
      state: "expiration_pending" as const,
      objectKey: "studio-video/message-1.mp4",
      expiresAt,
      deletedAt: null,
    };

    expect(canReplayStudioVideo(media, BASE_TIME + 1_000)).toBe(true);
    expect(
      canReplayStudioVideo(
        media,
        BASE_TIME + STUDIO_VIDEO_EXPIRATION_WINDOW_MS,
      ),
    ).toBe(false);
  });

  it("does not start expiration when completion is not verified", () => {
    expect(() =>
      completeStudioVideoWatch({
        currentState: "ready",
        progress: makeProgressThrough([[0, 50]]),
        completedAt: BASE_TIME,
      }),
    ).toThrow("WATCH_COMPLETION_NOT_VERIFIED");
  });
});

describe("Studio Video Messages — access, readiness, and transcript retention", () => {
  const baseAccess = {
    actorUserId: "pro-1",
    actorRole: "professional" as const,
    clientUserId: "client-1",
    studioId: "studio-1",
    relationshipStudioId: "studio-1",
    sameOrganization: true,
    relationshipActive: true,
    visibility: "shared_with_client" as const,
  };

  it("allows either authorized participant but rejects cross-org and inactive relationships", () => {
    expect(evaluateStudioVideoAccess(baseAccess)).toEqual({
      allowed: true,
      reason: "allowed",
    });
    expect(
      evaluateStudioVideoAccess({
        ...baseAccess,
        actorUserId: "client-1",
        actorRole: "client",
      }),
    ).toEqual({ allowed: true, reason: "allowed" });
    expect(
      evaluateStudioVideoAccess({
        ...baseAccess,
        sameOrganization: false,
      }),
    ).toEqual({ allowed: false, reason: "organization_mismatch" });
    expect(
      evaluateStudioVideoAccess({
        ...baseAccess,
        relationshipActive: false,
      }),
    ).toEqual({ allowed: false, reason: "relationship_missing" });
  });

  it("requires completed transcription, approved moderation, and a private object before playback", () => {
    expect(() =>
      assertStudioVideoReadyForPlayback({
        state: "ready",
        transcriptStatus: "completed",
        moderationStatus: "approved",
        objectKey: "studio-video/message-1.mp4",
      }),
    ).not.toThrow();
    expect(() =>
      assertStudioVideoReadyForPlayback({
        state: "ready",
        transcriptStatus: "pending",
        moderationStatus: "approved",
        objectKey: "studio-video/message-1.mp4",
      }),
    ).toThrow("INVALID_STUDIO_VIDEO_CONTRACT");
  });

  it("retains the transcript while removing media references after deletion", () => {
    const transcript = {
      status: "completed" as const,
      text: "A permanent coaching transcript.",
      transcribedAt: new Date(BASE_TIME).toISOString(),
    };
    expect(() =>
      assertStudioVideoManualDeletionEligible({
        state: "ready",
        objectKey: "studio-video/message-1.mp4",
        transcript,
      }),
    ).not.toThrow();
    expect(() =>
      assertStudioVideoManualDeletionEligible({
        state: "processing",
        objectKey: "studio-video/message-1.mp4",
        transcript,
      }),
    ).toThrow("VIDEO_MANUAL_DELETION_NOT_ALLOWED");
    expect(() =>
      assertStudioVideoManualDeletionEligible({
        state: "ready",
        objectKey: "studio-video/message-1.mp4",
        transcript: { ...transcript, status: "failed" as const, text: null },
      }),
    ).toThrow("VIDEO_TRANSCRIPT_NOT_RETAINABLE");

    const failedTranscription = {
      status: "failed" as const,
      text: null,
      transcribedAt: null,
    };
    expect(() =>
      assertStudioVideoManualDeletionEligible({
        state: "transcription_failed",
        objectKey: "studio-video/message-2.webm",
        transcript: failedTranscription,
      }),
    ).not.toThrow();
    expect(() =>
      assertStudioVideoManualDeletionEligible({
        state: "deletion_failed",
        objectKey: "studio-video/message-2.webm",
        transcript: failedTranscription,
      }),
    ).not.toThrow();

    const deleted = finalizeStudioVideoManualDeletion({
      currentState: "deleting",
      now: BASE_TIME,
      transcript,
    });
    expect(deleted).toMatchObject({
      state: "deleted",
      objectKey: null,
      temporaryDerivativeKeys: [],
      transcript,
    });

    expect(
      finalizeStudioVideoManualDeletion({
        currentState: "deleting",
        now: BASE_TIME,
        transcript: failedTranscription,
      }),
    ).toMatchObject({
      state: "deleted",
      objectKey: null,
      transcript: failedTranscription,
    });
  });
});

describe("Studio Video Messages — audit contract", () => {
  it("allows non-PHI lifecycle metadata and normalizes timestamps", () => {
    const event = createStudioVideoAuditEvent({
      event: "watch_completion_recorded",
      actorUserId: "client-1",
      targetUserId: "client-1",
      studioId: "studio-1",
      messageId: "message-1",
      occurredAt: BASE_TIME,
      metadata: { coverageRatio: 0.98, verified: true },
    });

    expect(event.occurredAt).toBe(new Date(BASE_TIME).toISOString());
    expect(event.metadata).toEqual({ coverageRatio: 0.98, verified: true });
  });

  it("allows sanitized transcription failure diagnostics", () => {
    const event = createStudioVideoAuditEvent({
      event: "transcription_failed",
      actorUserId: "client-1",
      targetUserId: "client-1",
      studioId: "studio-1",
      messageId: "message-1",
      occurredAt: BASE_TIME,
      metadata: {
        provider: "openai",
        failureCategory: "timeout",
        sdkErrorClass: "APITimeoutError",
      },
    });

    expect(event.metadata).toEqual({
      provider: "openai",
      failureCategory: "timeout",
      sdkErrorClass: "APITimeoutError",
    });
  });

  it("rejects transcript, URL, token, object-key, and nested content metadata", () => {
    for (const metadata of [
      { transcript: "sensitive content" },
      { playbackUrl: "https://example.invalid/video" },
      { token: "secret" },
      { objectKey: "studio-video/message-1.mp4" },
      { details: { transcript: "sensitive content" } },
    ]) {
      expect(() =>
        createStudioVideoAuditEvent({
          event: "playback_authorized",
          actorUserId: "pro-1",
          targetUserId: "client-1",
          studioId: "studio-1",
          messageId: "message-1",
          occurredAt: BASE_TIME,
          metadata,
        }),
      ).toThrow("VIDEO_AUDIT_METADATA_UNSAFE");
    }
  });
});
