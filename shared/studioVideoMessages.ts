/**
 * Studio Video Messages — shared foundation contract.
 *
 * This module is intentionally side-effect free. It defines the contract that
 * future capture, playback, storage, transcription, and purge implementations
 * must follow without coupling those implementations to Express, a database,
 * or a storage provider.
 */

export const STUDIO_VIDEO_MESSAGE_CONTRACT_VERSION =
  "studio-video-messages-foundation-v1";
export const STUDIO_VIDEO_MESSAGES_FEATURE_KEY = "studio_video_messages";
// The delivery slice is enabled by default. Operators can set
// STUDIO_VIDEO_MESSAGES_ENABLED=false for an emergency kill switch; the
// low-level contract validator still fails closed for missing/invalid values.
export const STUDIO_VIDEO_MESSAGES_DEFAULT_ENABLED = true;

export const STUDIO_VIDEO_MESSAGE_VISIBILITIES = [
  "shared_with_client",
] as const;
export type StudioVideoMessageVisibility =
  (typeof STUDIO_VIDEO_MESSAGE_VISIBILITIES)[number];

export const STUDIO_VIDEO_MESSAGE_SENDERS = ["client", "pro"] as const;
export type StudioVideoMessageSender =
  (typeof STUDIO_VIDEO_MESSAGE_SENDERS)[number];

export const STUDIO_VIDEO_MEDIA_STATES = [
  "draft",
  "uploading",
  "uploaded",
  "processing",
  "ready",
  "upload_failed",
  "transcription_failed",
  "moderation_failed",
  "expiration_pending",
  "expired",
  "deleting",
  "deletion_failed",
  "deleted",
] as const;
export type StudioVideoMediaState = (typeof STUDIO_VIDEO_MEDIA_STATES)[number];

export const STUDIO_VIDEO_TRANSCRIPT_STATUSES = [
  "pending",
  "completed",
  "failed",
  "blocked",
] as const;
export type StudioVideoTranscriptStatus =
  (typeof STUDIO_VIDEO_TRANSCRIPT_STATUSES)[number];

export const STUDIO_VIDEO_MODERATION_STATUSES = [
  "pending",
  "approved",
  "blocked",
] as const;
export type StudioVideoModerationStatus =
  (typeof STUDIO_VIDEO_MODERATION_STATUSES)[number];

export const STUDIO_VIDEO_MEDIA_TYPE = "video" as const;
export const STUDIO_VIDEO_EXPIRATION_WINDOW_MS = 24 * 60 * 60 * 1000;

// Five minutes at these capture targets is approximately 46.8 MB (44.6 MiB)
// before container overhead. The 64 MiB upload ceiling leaves headroom while
// preventing arbitrary browser-default camera bitrates from reaching memory
// storage and the transcription pipeline.
export const STUDIO_VIDEO_MAX_DURATION_SEC = 5 * 60;
export const STUDIO_VIDEO_CAPTURE_VIDEO_BITS_PER_SECOND = 1_200_000;
export const STUDIO_VIDEO_CAPTURE_AUDIO_BITS_PER_SECOND = 48_000;
export const STUDIO_VIDEO_MAX_UPLOAD_BYTES = 64 * 1024 * 1024;

/**
 * Completion requires both broad coverage and verified progress near the end.
 * The second condition prevents a user from satisfying coverage by watching
 * the beginning and then seeking to the final second.
 */
export const STUDIO_VIDEO_COMPLETION_MIN_COVERAGE_RATIO = 0.95;
export const STUDIO_VIDEO_COMPLETION_NEAR_END_RATIO = 0.98;
export const STUDIO_VIDEO_PROGRESS_CLOCK_SKEW_SEC = 0.75;
export const STUDIO_VIDEO_DURATION_TOLERANCE_SEC = 0.5;

export type StudioVideoDomainErrorCode =
  | "STUDIO_VIDEO_MESSAGES_DISABLED"
  | "INVALID_STUDIO_VIDEO_CONTRACT"
  | "INVALID_STUDIO_VIDEO_TRANSITION"
  | "INVALID_STUDIO_VIDEO_TIMESTAMP"
  | "INVALID_STUDIO_VIDEO_WATCH_SAMPLE"
  | "WATCH_COMPLETION_NOT_VERIFIED"
  | "VIDEO_EXPIRATION_NOT_REACHED"
  | "VIDEO_TRANSCRIPT_NOT_RETAINABLE"
  | "VIDEO_MANUAL_DELETION_NOT_ALLOWED"
  | "VIDEO_STORAGE_NOT_PRIVATE"
  | "VIDEO_AUDIT_METADATA_UNSAFE";

export class StudioVideoDomainError extends Error {
  readonly code: StudioVideoDomainErrorCode;

  constructor(code: StudioVideoDomainErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.name = "StudioVideoDomainError";
    this.code = code;
  }
}

export type StudioVideoTranscript = {
  status: StudioVideoTranscriptStatus;
  text: string | null;
  transcribedAt: string | null;
};

export type StudioVideoMedia = {
  state: StudioVideoMediaState;
  objectKey: string | null;
  mimeType: string | null;
  durationSec: number | null;
  sizeBytes: number | null;
  temporaryDerivativeKeys: readonly string[];
  watchCompletedAt: string | null;
  expiresAt: string | null;
  deletedAt: string | null;
};

/**
 * The Studio message is the permanent communication record. The media child
 * is temporary; the transcript is retained with the communication record.
 */
export type StudioVideoMessage = {
  id: string;
  studioId: string;
  clientUserId: string;
  authorUserId: string;
  recipientUserId: string;
  sender: StudioVideoMessageSender;
  visibility: StudioVideoMessageVisibility;
  contentType: typeof STUDIO_VIDEO_MEDIA_TYPE;
  body: string;
  transcript: StudioVideoTranscript;
  media: StudioVideoMedia;
};

export type StudioVideoMessageParticipants = Pick<
  StudioVideoMessage,
  | "studioId"
  | "clientUserId"
  | "authorUserId"
  | "recipientUserId"
  | "sender"
  | "visibility"
>;

function requireNonEmptyId(value: string, field: string): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new StudioVideoDomainError(
      "INVALID_STUDIO_VIDEO_CONTRACT",
      `${field} is required`,
    );
  }
}

/**
 * The feature flag is fail-closed: missing, undefined, and non-boolean values
 * do not activate video messaging.
 */
export function isStudioVideoMessagesEnabled(value: unknown): value is true {
  return value === true;
}

export function assertStudioVideoMessagesEnabled(value: unknown): void {
  if (!isStudioVideoMessagesEnabled(value)) {
    throw new StudioVideoDomainError(
      "STUDIO_VIDEO_MESSAGES_DISABLED",
      "Studio Video Messages are disabled",
    );
  }
}

/**
 * Validates the shared message relationship without assigning a physician- or
 * coach-specific implementation. The server remains responsible for proving
 * the relationship and organization boundary before calling this contract.
 */
export function assertStudioVideoMessageParticipants(
  participants: StudioVideoMessageParticipants,
): void {
  requireNonEmptyId(participants.studioId, "studioId");
  requireNonEmptyId(participants.clientUserId, "clientUserId");
  requireNonEmptyId(participants.authorUserId, "authorUserId");
  requireNonEmptyId(participants.recipientUserId, "recipientUserId");

  if (participants.visibility !== "shared_with_client") {
    throw new StudioVideoDomainError(
      "INVALID_STUDIO_VIDEO_CONTRACT",
      "Studio Video Messages must be shared with the client",
    );
  }

  if (participants.authorUserId === participants.recipientUserId) {
    throw new StudioVideoDomainError(
      "INVALID_STUDIO_VIDEO_CONTRACT",
      "Studio Video Message author and recipient must differ",
    );
  }

  if (participants.sender === "client") {
    if (participants.authorUserId !== participants.clientUserId) {
      throw new StudioVideoDomainError(
        "INVALID_STUDIO_VIDEO_CONTRACT",
        "Client-sent video messages must be authored by the client",
      );
    }
  } else if (participants.recipientUserId !== participants.clientUserId) {
    throw new StudioVideoDomainError(
      "INVALID_STUDIO_VIDEO_CONTRACT",
      "Professional-sent video messages must be addressed to the client",
    );
  }
}

const STUDIO_VIDEO_ALLOWED_TRANSITIONS: Record<
  StudioVideoMediaState,
  readonly StudioVideoMediaState[]
> = {
  draft: ["uploading", "upload_failed"],
  uploading: ["uploaded", "upload_failed"],
  uploaded: ["processing", "upload_failed"],
  processing: ["ready", "transcription_failed", "moderation_failed"],
  ready: ["expiration_pending", "deleting"],
  upload_failed: ["uploading"],
  transcription_failed: ["processing", "deleting"],
  moderation_failed: ["processing"],
  expiration_pending: ["expired", "deleting"],
  expired: ["deleting"],
  deleting: ["deleted", "deletion_failed"],
  deletion_failed: ["deleting"],
  deleted: [],
};

export function allowedStudioVideoTransitions(
  state: StudioVideoMediaState,
): readonly StudioVideoMediaState[] {
  return STUDIO_VIDEO_ALLOWED_TRANSITIONS[state];
}

function timestampMs(value: Date | string | number, field: string): number {
  const parsed =
    value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (!Number.isFinite(parsed)) {
    throw new StudioVideoDomainError(
      "INVALID_STUDIO_VIDEO_TIMESTAMP",
      `${field} must be a valid timestamp`,
    );
  }
  return parsed;
}

export type StudioVideoTransitionInput = {
  currentState: StudioVideoMediaState;
  nextState: StudioVideoMediaState;
  now: Date | string | number;
  expiresAt?: string | null;
};

/**
 * Checks the state machine and enforces the time gate before expiration.
 * Same-state transitions are idempotent so retries do not create invalid
 * lifecycle edges.
 */
export function assertStudioVideoTransition(
  input: StudioVideoTransitionInput,
): void {
  const nowMs = timestampMs(input.now, "now");

  if (input.currentState === input.nextState) return;

  if (!STUDIO_VIDEO_ALLOWED_TRANSITIONS[input.currentState].includes(
    input.nextState,
  )) {
    throw new StudioVideoDomainError(
      "INVALID_STUDIO_VIDEO_TRANSITION",
      `Cannot transition Studio Video Message from ${input.currentState} to ${input.nextState}`,
    );
  }

  if (input.nextState === "expired") {
    if (!input.expiresAt) {
      throw new StudioVideoDomainError(
        "INVALID_STUDIO_VIDEO_TIMESTAMP",
        "Expiration timestamp is required before media can expire",
      );
    }
    if (nowMs < timestampMs(input.expiresAt, "expiresAt")) {
      throw new StudioVideoDomainError(
        "VIDEO_EXPIRATION_NOT_REACHED",
        "Video expiration time has not been reached",
      );
    }
  }
}

function validDuration(durationSec: number): boolean {
  return Number.isFinite(durationSec) && durationSec > 0;
}

export type VerifiedWatchProgress = {
  durationSec: number;
  watchedIntervals: readonly (readonly [number, number])[];
  lastPositionSec: number | null;
  lastObservedAtMs: number | null;
  maxVerifiedPositionSec: number;
  rejectedSampleCount: number;
};

export type WatchProgressSample = {
  durationSec: number;
  positionSec: number;
  observedAtMs: number;
  isPlaying: boolean;
  isSeeking?: boolean;
  playbackRate?: number;
};

export type WatchProgressResult = {
  progress: VerifiedWatchProgress;
  accepted: boolean;
  reason:
    | "initialized"
    | "verified_playback"
    | "paused"
    | "seeking"
    | "reverse_seek"
    | "unverified_jump"
    | "non_monotonic_sample"
    | "invalid_sample";
  coverageRatio: number;
  nearEndReached: boolean;
  complete: boolean;
};

export function createVerifiedWatchProgress(
  durationSec: number,
): VerifiedWatchProgress {
  if (!validDuration(durationSec)) {
    throw new StudioVideoDomainError(
      "INVALID_STUDIO_VIDEO_WATCH_SAMPLE",
      "Video duration must be greater than zero",
    );
  }

  return {
    durationSec,
    watchedIntervals: [],
    lastPositionSec: null,
    lastObservedAtMs: null,
    maxVerifiedPositionSec: 0,
    rejectedSampleCount: 0,
  };
}

function mergeWatchedInterval(
  intervals: readonly (readonly [number, number])[],
  startSec: number,
  endSec: number,
): readonly (readonly [number, number])[] {
  if (endSec <= startSec) return intervals;

  const next = [...intervals, [startSec, endSec] as const].sort(
    (a, b) => a[0] - b[0],
  );
  const merged: Array<readonly [number, number]> = [];

  for (const interval of next) {
    const previous = merged[merged.length - 1];
    if (!previous || interval[0] > previous[1]) {
      merged.push(interval);
      continue;
    }

    merged[merged.length - 1] = [
      previous[0],
      Math.max(previous[1], interval[1]),
    ];
  }

  return merged;
}

function watchedSeconds(
  intervals: readonly (readonly [number, number])[],
): number {
  return intervals.reduce((total, [start, end]) => total + (end - start), 0);
}

export function getVerifiedWatchSummary(progress: VerifiedWatchProgress): {
  watchedSeconds: number;
  coverageRatio: number;
  nearEndReached: boolean;
  complete: boolean;
} {
  const watched = watchedSeconds(progress.watchedIntervals);
  const coverageRatio = Math.min(1, watched / progress.durationSec);
  const nearEndReached =
    progress.maxVerifiedPositionSec >=
    progress.durationSec * STUDIO_VIDEO_COMPLETION_NEAR_END_RATIO;

  return {
    watchedSeconds: watched,
    coverageRatio,
    nearEndReached,
    complete:
      coverageRatio >= STUDIO_VIDEO_COMPLETION_MIN_COVERAGE_RATIO &&
      nearEndReached,
  };
}

/**
 * Accepts only forward playback that could plausibly have happened between
 * two timestamped samples. Seeking, pausing, reverse movement, and jumps that
 * outrun the elapsed wall-clock time never add watched intervals.
 */
export function recordVerifiedWatchProgress(
  previous: VerifiedWatchProgress,
  sample: WatchProgressSample,
): WatchProgressResult {
  const invalidResult = (
    reason: WatchProgressResult["reason"],
  ): WatchProgressResult => {
    const progress = {
      ...previous,
      rejectedSampleCount: previous.rejectedSampleCount + 1,
    };
    const summary = getVerifiedWatchSummary(progress);
    return { progress, accepted: false, reason, ...summary };
  };

  if (
    !validDuration(sample.durationSec) ||
    Math.abs(sample.durationSec - previous.durationSec) >
      STUDIO_VIDEO_DURATION_TOLERANCE_SEC ||
    !Number.isFinite(sample.positionSec) ||
    sample.positionSec < 0 ||
    sample.positionSec > sample.durationSec ||
    !Number.isFinite(sample.observedAtMs)
  ) {
    return invalidResult("invalid_sample");
  }

  if (
    previous.lastObservedAtMs !== null &&
    sample.observedAtMs <= previous.lastObservedAtMs
  ) {
    return invalidResult("non_monotonic_sample");
  }

  const position = Math.min(previous.durationSec, Math.max(0, sample.positionSec));
  if (previous.lastPositionSec === null || previous.lastObservedAtMs === null) {
    const progress: VerifiedWatchProgress = {
      ...previous,
      lastPositionSec: position,
      lastObservedAtMs: sample.observedAtMs,
    };
    return {
      progress,
      accepted: false,
      reason: "initialized",
      ...getVerifiedWatchSummary(progress),
    };
  }

  const elapsedSec =
    (sample.observedAtMs - previous.lastObservedAtMs) / 1000;
  const positionDelta = position - previous.lastPositionSec;
  const progressBase = {
    ...previous,
    lastPositionSec: position,
    lastObservedAtMs: sample.observedAtMs,
  };

  if (sample.isSeeking) {
    const progress = {
      ...progressBase,
      rejectedSampleCount: previous.rejectedSampleCount + 1,
    };
    return {
      progress,
      accepted: false,
      reason: "seeking",
      ...getVerifiedWatchSummary(progress),
    };
  }

  if (!sample.isPlaying || positionDelta === 0 || elapsedSec <= 0) {
    return {
      progress: progressBase,
      accepted: false,
      reason: "paused",
      ...getVerifiedWatchSummary(progressBase),
    };
  }

  if (positionDelta < 0) {
    const progress = {
      ...progressBase,
      rejectedSampleCount: previous.rejectedSampleCount + 1,
    };
    return {
      progress,
      accepted: false,
      reason: "reverse_seek",
      ...getVerifiedWatchSummary(progress),
    };
  }

  const playbackRate = Math.min(
    2,
    Math.max(0.1, sample.playbackRate ?? 1),
  );
  const maximumPlausibleDelta =
    elapsedSec * playbackRate + STUDIO_VIDEO_PROGRESS_CLOCK_SKEW_SEC;

  if (positionDelta > maximumPlausibleDelta) {
    const progress = {
      ...progressBase,
      rejectedSampleCount: previous.rejectedSampleCount + 1,
    };
    return {
      progress,
      accepted: false,
      reason: "unverified_jump",
      ...getVerifiedWatchSummary(progress),
    };
  }

  const watchedIntervals = mergeWatchedInterval(
    previous.watchedIntervals,
    previous.lastPositionSec,
    position,
  );
  const progress: VerifiedWatchProgress = {
    ...progressBase,
    watchedIntervals,
    maxVerifiedPositionSec: Math.max(
      previous.maxVerifiedPositionSec,
      position,
    ),
  };

  return {
    progress,
    accepted: true,
    reason: "verified_playback",
    ...getVerifiedWatchSummary(progress),
  };
}

export type StudioVideoWatchCompletion = {
  state: "expiration_pending";
  watchCompletedAt: string;
  expiresAt: string;
};

export function completeStudioVideoWatch(input: {
  currentState: StudioVideoMediaState;
  progress: VerifiedWatchProgress;
  completedAt: Date | string | number;
}): StudioVideoWatchCompletion {
  if (!getVerifiedWatchSummary(input.progress).complete) {
    throw new StudioVideoDomainError(
      "WATCH_COMPLETION_NOT_VERIFIED",
      "Video watch completion requires verified near-complete playback",
    );
  }

  if (input.currentState !== "ready") {
    throw new StudioVideoDomainError(
      "INVALID_STUDIO_VIDEO_TRANSITION",
      `Cannot complete playback from ${input.currentState}`,
    );
  }

  const completedAtMs = timestampMs(input.completedAt, "completedAt");
  const watchCompletedAt = new Date(completedAtMs).toISOString();
  const expiresAt = new Date(
    completedAtMs + STUDIO_VIDEO_EXPIRATION_WINDOW_MS,
  ).toISOString();

  return { state: "expiration_pending", watchCompletedAt, expiresAt };
}

export function canReplayStudioVideo(
  media: Pick<
    StudioVideoMedia,
    "state" | "objectKey" | "expiresAt" | "deletedAt"
  >,
  now: Date | string | number,
): boolean {
  if (!media.objectKey || media.deletedAt || media.state === "deleted") {
    return false;
  }

  if (media.state === "ready") return true;
  if (media.state !== "expiration_pending" || !media.expiresAt) return false;

  return timestampMs(now, "now") < timestampMs(media.expiresAt, "expiresAt");
}

export function assertStudioVideoReadyForPlayback(input: {
  state: StudioVideoMediaState;
  transcriptStatus: StudioVideoTranscriptStatus;
  moderationStatus: StudioVideoModerationStatus;
  objectKey: string | null;
}): void {
  if (
    (input.state !== "ready" && input.state !== "expiration_pending") ||
    input.transcriptStatus !== "completed" ||
    input.moderationStatus !== "approved" ||
    !input.objectKey
  ) {
    throw new StudioVideoDomainError(
      "INVALID_STUDIO_VIDEO_CONTRACT",
      "Video playback requires ready, moderated media with a completed transcript",
    );
  }
}

export function assertStudioVideoTranscriptRetainable(
  transcript: StudioVideoTranscript,
): void {
  if (transcript.status !== "completed" || transcript.text === null) {
    throw new StudioVideoDomainError(
      "VIDEO_TRANSCRIPT_NOT_RETAINABLE",
      "A deleted video must retain its completed transcript",
    );
  }
}

/**
 * Manual deletion removes only the temporary private media. The permanent
 * message record and its completed transcript remain available for the
 * communication history.
 */
export function assertStudioVideoManualDeletionEligible(input: {
  state: StudioVideoMediaState;
  objectKey: string | null;
  transcript: StudioVideoTranscript;
}): void {
  const hasFailedTranscriptionHistory =
    input.transcript.status === "failed" &&
    input.transcript.text === null;
  const isFailedTranscriptionDeletion =
    hasFailedTranscriptionHistory &&
    ["transcription_failed", "deletion_failed"].includes(input.state);

  if (
    !["ready", "expiration_pending", "deletion_failed", "transcription_failed"].includes(
      input.state,
    )
  ) {
    throw new StudioVideoDomainError(
      "VIDEO_MANUAL_DELETION_NOT_ALLOWED",
      `Video media cannot be manually deleted from ${input.state}`,
    );
  }
  if (input.state === "transcription_failed" && !hasFailedTranscriptionHistory) {
    throw new StudioVideoDomainError(
      "VIDEO_MANUAL_DELETION_NOT_ALLOWED",
      "A failed-transcription video must retain its failed transcript status",
    );
  }
  if (!input.objectKey) {
    throw new StudioVideoDomainError(
      "VIDEO_MANUAL_DELETION_NOT_ALLOWED",
      "Video media has no private object to delete",
    );
  }
  if (!isFailedTranscriptionDeletion) {
    assertStudioVideoTranscriptRetainable(input.transcript);
  }
}

export type StudioVideoManualDeletionResult = {
  state: "deleted";
  objectKey: null;
  temporaryDerivativeKeys: readonly [];
  deletedAt: string;
  transcript: StudioVideoTranscript;
};

/**
 * Represents a manually deleted media record. The caller must make the
 * deletion durable in private storage before persisting this result.
 */
export function finalizeStudioVideoManualDeletion(input: {
  currentState: "deleting";
  now: Date | string | number;
  transcript: StudioVideoTranscript;
}): StudioVideoManualDeletionResult {
  const nowMs = timestampMs(input.now, "now");
  const isFailedTranscriptionHistory =
    input.transcript.status === "failed" &&
    input.transcript.text === null;
  if (!isFailedTranscriptionHistory) {
    assertStudioVideoTranscriptRetainable(input.transcript);
  }

  return {
    state: "deleted",
    objectKey: null,
    temporaryDerivativeKeys: [],
    deletedAt: new Date(nowMs).toISOString(),
    transcript: input.transcript,
  };
}

export type StudioVideoDeletionResult = {
  state: "deleted";
  objectKey: null;
  temporaryDerivativeKeys: readonly [];
  deletedAt: string;
  transcript: StudioVideoTranscript;
  watchCompletedAt: string;
  expiresAt: string;
};

/**
 * Represents the post-purge record. It does not delete anything itself; the
 * future deletion worker must make the storage deletion durable before
 * persisting this result.
 */
export function finalizeStudioVideoDeletion(input: {
  currentState: "expired" | "deleting";
  now: Date | string | number;
  expiresAt: string;
  watchCompletedAt: string;
  transcript: StudioVideoTranscript;
}): StudioVideoDeletionResult {
  const nowMs = timestampMs(input.now, "now");
  const expiresAtMs = timestampMs(input.expiresAt, "expiresAt");
  if (nowMs < expiresAtMs) {
    throw new StudioVideoDomainError(
      "VIDEO_EXPIRATION_NOT_REACHED",
      "Video cannot be finalized before its expiration time",
    );
  }
  if (input.currentState !== "expired" && input.currentState !== "deleting") {
    throw new StudioVideoDomainError(
      "INVALID_STUDIO_VIDEO_TRANSITION",
      `Cannot delete video from ${input.currentState}`,
    );
  }

  assertStudioVideoTranscriptRetainable(input.transcript);
  const deletedAt = new Date(nowMs).toISOString();

  return {
    state: "deleted",
    objectKey: null,
    temporaryDerivativeKeys: [],
    deletedAt,
    transcript: input.transcript,
    watchCompletedAt: input.watchCompletedAt,
    expiresAt: input.expiresAt,
  };
}

export type StudioVideoAccessContext = {
  actorUserId: string | null | undefined;
  actorRole: "client" | "professional" | null | undefined;
  clientUserId: string;
  studioId: string;
  relationshipStudioId: string | null | undefined;
  sameOrganization: boolean;
  relationshipActive: boolean;
  visibility: StudioVideoMessageVisibility;
};

export type StudioVideoAccessDecision = {
  allowed: boolean;
  reason:
    | "allowed"
    | "missing_actor"
    | "invalid_visibility"
    | "organization_mismatch"
    | "relationship_missing"
    | "client_identity_mismatch"
    | "professional_identity_invalid"
    | "studio_mismatch";
};

/**
 * Pure policy check for future routes. Database-backed middleware must provide
 * the relationship and organization facts; this function never trusts a
 * client-submitted role or studio ID on its own.
 */
export function evaluateStudioVideoAccess(
  context: StudioVideoAccessContext,
): StudioVideoAccessDecision {
  if (!context.actorUserId) return { allowed: false, reason: "missing_actor" };
  if (context.visibility !== "shared_with_client") {
    return { allowed: false, reason: "invalid_visibility" };
  }
  if (!context.sameOrganization) {
    return { allowed: false, reason: "organization_mismatch" };
  }
  if (!context.relationshipActive) {
    return { allowed: false, reason: "relationship_missing" };
  }
  if (context.relationshipStudioId !== context.studioId) {
    return { allowed: false, reason: "studio_mismatch" };
  }

  if (context.actorRole === "client") {
    return context.actorUserId === context.clientUserId
      ? { allowed: true, reason: "allowed" }
      : { allowed: false, reason: "client_identity_mismatch" };
  }

  if (context.actorRole === "professional" && context.actorUserId !== context.clientUserId) {
    return { allowed: true, reason: "allowed" };
  }

  return { allowed: false, reason: "professional_identity_invalid" };
}

export const STUDIO_VIDEO_STORAGE_POLICY = {
  storageClass: "private",
  publicUrlAllowed: false,
  signedPlaybackRequired: true,
  cacheControl: "no-store",
  mediaNamespace: "studio-video",
  transcriptStoredWithMessage: true,
} as const;

export type StudioVideoStorageValidationInput = {
  isPrivate: boolean;
  publicUrlAllowed: boolean;
  signedPlaybackRequired: boolean;
  cacheControl: string;
};

export function assertPrivateStudioVideoStorage(
  input: StudioVideoStorageValidationInput,
): void {
  if (
    !input.isPrivate ||
    input.publicUrlAllowed ||
    !input.signedPlaybackRequired ||
    input.cacheControl.toLowerCase() !== "no-store"
  ) {
    throw new StudioVideoDomainError(
      "VIDEO_STORAGE_NOT_PRIVATE",
      "Studio Video Messages require private, signed, non-cacheable playback",
    );
  }
}

export const STUDIO_VIDEO_AUDIT_EVENTS = [
  "message_created",
  "upload_started",
  "upload_completed",
  "transcription_requested",
  "transcription_completed",
  "transcription_failed",
  "moderation_completed",
  "playback_authorized",
  "watch_completion_recorded",
  "expiration_started",
  "expiration_reached",
  "deletion_requested",
  "media_deleted",
  "deletion_failed",
  "access_denied",
] as const;
export type StudioVideoAuditEvent = (typeof STUDIO_VIDEO_AUDIT_EVENTS)[number];

export const STUDIO_VIDEO_FORBIDDEN_AUDIT_KEYS = [
  "body",
  "content",
  "text",
  "transcript",
  "url",
  "token",
  "objectkey",
  "filename",
  "media",
  "video",
  "audio",
  "blob",
  "raw",
] as const;

export type StudioVideoAuditMetadataValue = string | number | boolean | null;
export type StudioVideoAuditMetadata = Record<
  string,
  StudioVideoAuditMetadataValue
>;

export type StudioVideoAuditEventRecord = {
  event: StudioVideoAuditEvent;
  actorUserId: string;
  targetUserId: string;
  studioId: string;
  messageId: string;
  occurredAt: string;
  metadata: StudioVideoAuditMetadata;
};

export function isSafeStudioVideoAuditMetadata(
  metadata: Record<string, unknown> | null | undefined,
): metadata is StudioVideoAuditMetadata {
  if (!metadata) return true;

  return Object.entries(metadata).every(([key, value]) => {
    const normalizedKey = key.toLowerCase().replace(/[_-]/g, "");
    if (
      STUDIO_VIDEO_FORBIDDEN_AUDIT_KEYS.some(
        (forbidden) => normalizedKey.includes(forbidden),
      )
    ) {
      return false;
    }
    return (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    );
  });
}

export function createStudioVideoAuditEvent(input: {
  event: StudioVideoAuditEvent;
  actorUserId: string;
  targetUserId: string;
  studioId: string;
  messageId: string;
  occurredAt: Date | string | number;
  metadata?: Record<string, unknown> | null;
}): StudioVideoAuditEventRecord {
  requireNonEmptyId(input.actorUserId, "actorUserId");
  requireNonEmptyId(input.targetUserId, "targetUserId");
  requireNonEmptyId(input.studioId, "studioId");
  requireNonEmptyId(input.messageId, "messageId");

  if (!isSafeStudioVideoAuditMetadata(input.metadata)) {
    throw new StudioVideoDomainError(
      "VIDEO_AUDIT_METADATA_UNSAFE",
      "Studio Video audit metadata must not contain PHI or media secrets",
    );
  }

  return {
    event: input.event,
    actorUserId: input.actorUserId,
    targetUserId: input.targetUserId,
    studioId: input.studioId,
    messageId: input.messageId,
    occurredAt: new Date(timestampMs(input.occurredAt, "occurredAt")).toISOString(),
    metadata: (input.metadata ?? {}) as StudioVideoAuditMetadata,
  };
}