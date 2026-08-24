import {
  STUDIO_VIDEO_EXPIRATION_WINDOW_MS,
  assertPrivateStudioVideoStorage,
  assertStudioVideoMessagesEnabled,
  assertStudioVideoReadyForPlayback,
  assertStudioVideoTransition,
  assertStudioVideoTranscriptRetainable,
  canReplayStudioVideo,
  completeStudioVideoWatch,
  createStudioVideoAuditEvent,
  createVerifiedWatchProgress,
  evaluateStudioVideoAccess,
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
    let progress = createVerifiedWatchProgress(100);
    expect(getVerifiedWatchSummary(progress).complete).toBe(false);

    progress = recordVerifiedWatchProgress(progress, {
      durationSec: 100,
      positionSec: 0,
      observedAtMs: BASE_TIME,
      isPlaying: true,
    }).progress;
    expect(getVerifiedWatchSummary(progress).complete).toBe(false);

    progress = recordVerifiedWatchProgress(progress, {
      durationSec: 100,
      positionSec: 50,
      observedAtMs: BASE_TIME + 50_000,
      isPlaying: true,
    }).progress;
    progress = recordVerifiedWatchProgress(progress, {
      durationSec: 100,
      positionSec: 50,
      observedAtMs: BASE_TIME + 60_000,
      isPlaying: false,
    }).progress;

    expect(getVerifiedWatchSummary(progress).coverageRatio).toBeCloseTo(0.5);
    expect(getVerifiedWatchSummary(progress).complete).toBe(false);
  });

  it("rejects a scrub to the last second as unverified progress", () => {
    let progress = createVerifiedWatchProgress(100);
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
    expect(result.reason).toBe("unverified_jump");
    expect(result.progress.watchedIntervals).toEqual([]);
    expect(result.complete).toBe(false);
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
      [0, 50],
      [0, 50],
      [50, 98],
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
    expect(() => assertStudioVideoTranscriptRetainable(transcript)).not.toThrow();

    const deleted = finalizeStudioVideoDeletion({
      currentState: "deleting",
      now: BASE_TIME + STUDIO_VIDEO_EXPIRATION_WINDOW_MS,
      expiresAt: new Date(BASE_TIME).toISOString(),
      watchCompletedAt: new Date(BASE_TIME - STUDIO_VIDEO_EXPIRATION_WINDOW_MS).toISOString(),
      transcript,
    });

    expect(deleted.state).toBe("deleted");
    expect(deleted.objectKey).toBeNull();
    expect(deleted.temporaryDerivativeKeys).toEqual([]);
    expect(deleted.transcript).toEqual(transcript);
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