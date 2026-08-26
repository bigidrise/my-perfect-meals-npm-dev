export type StudioVideoStorageFailureCategory =
  | "permission_denied"
  | "not_found"
  | "rate_limited"
  | "invalid_request"
  | "conflict"
  | "provider_unavailable"
  | "network"
  | "configuration"
  | "unknown";

export type StudioVideoStorageDeleteDiagnostic = {
  sdkErrorClass: string;
  failureCategory: StudioVideoStorageFailureCategory;
  objectExistedBeforeDelete: boolean | "unknown";
  statusCode?: number;
  providerRequestId?: string;
};

type ErrorRecord = Record<string, unknown>;

const diagnosticProperty = Symbol("studioVideoStorageDeleteDiagnostic");

export type StudioVideoDeletionFailureStage =
  | "storage_delete"
  | "finalization_guard"
  | "unknown";

export type StudioVideoDeletionFailureDiagnostic = {
  failureStage: StudioVideoDeletionFailureStage;
  requestId: string;
  httpOutcome: number;
  leaseStatus: "valid" | "lost" | "unknown";
  storageDeletionCompleted: boolean;
  sdkErrorClass?: string;
  sdkStatus?: number;
};

function asErrorRecord(error: unknown): ErrorRecord {
  return error !== null && typeof error === "object" ? error as ErrorRecord : {};
}

function safeIdentifier(value: unknown, maxLength = 120): string | undefined {
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength) {
    return undefined;
  }
  return /^[A-Za-z0-9._:-]+$/.test(value) ? value : undefined;
}

function safeStatus(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 599
    ? value
    : undefined;
}

function safeRequestId(value: unknown): string {
  return safeIdentifier(value) ?? "unknown";
}

function normalizeFailureCategory(input: {
  errorClass: string;
  statusCode?: number;
  code?: string;
  message?: string;
}): StudioVideoStorageFailureCategory {
  if (input.statusCode === 401 || input.statusCode === 403) return "permission_denied";
  if (input.statusCode === 404) return "not_found";
  if (input.statusCode === 409) return "conflict";
  if (input.statusCode === 429) return "rate_limited";
  if (input.statusCode === 400 || input.statusCode === 413 || input.statusCode === 422) {
    return "invalid_request";
  }
  if (input.statusCode !== undefined && input.statusCode >= 500) {
    return "provider_unavailable";
  }
  if (input.code === "ECONNRESET" || input.code === "ENOTFOUND" || input.code === "ETIMEDOUT") {
    return "network";
  }

  const message = input.message?.toLowerCase() ?? "";
  if (message.includes("default bucket") || message.includes("running on replit")) {
    return "configuration";
  }
  if (message.includes("timeout") || message.includes("network") || message.includes("socket")) {
    return "network";
  }
  return "unknown";
}

/**
 * Extracts only operationally safe fields from a Replit Object Storage delete
 * error. It intentionally excludes the object key, provider message, response
 * body, signed URLs, and all Studio/user content.
 */
export function getStudioVideoStorageDeleteDiagnostic(
  error: unknown,
  objectExistedBeforeDelete: boolean | "unknown" = "unknown",
): StudioVideoStorageDeleteDiagnostic {
  const record = asErrorRecord(error);
  const constructorName = safeIdentifier(
    (error as { constructor?: { name?: unknown } } | null)?.constructor?.name,
  );
  const errorClass = safeIdentifier(record.name)
    ?? (constructorName && constructorName !== "Object" ? constructorName : undefined)
    // The Replit SDK normalizes API errors into the RequestError shape.
    ?? "RequestError";
  const statusCode = safeStatus(record.statusCode) ?? safeStatus(record.status);
  const providerRequestId = safeIdentifier(record.requestId)
    ?? safeIdentifier(record.request_id)
    ?? safeIdentifier(record.requestID)
    ?? safeIdentifier(record.request_id_header);
  const code = safeIdentifier(record.code);
  const message = typeof record.message === "string" ? record.message : undefined;

  return {
    sdkErrorClass: errorClass,
    failureCategory: normalizeFailureCategory({
      errorClass,
      statusCode,
      code,
      message,
    }),
    objectExistedBeforeDelete,
    ...(statusCode !== undefined ? { statusCode } : {}),
    ...(providerRequestId ? { providerRequestId } : {}),
  };
}

export function attachStudioVideoStorageDeleteDiagnostic(
  error: Error,
  diagnostic: StudioVideoStorageDeleteDiagnostic,
): Error {
  Object.defineProperty(error, diagnosticProperty, {
    configurable: true,
    enumerable: false,
    value: diagnostic,
  });
  return error;
}

export function getAttachedStudioVideoStorageDeleteDiagnostic(
  error: unknown,
): StudioVideoStorageDeleteDiagnostic | undefined {
  if (error === null || typeof error !== "object") return undefined;
  return (error as { [diagnosticProperty]?: StudioVideoStorageDeleteDiagnostic })[diagnosticProperty];
}

/**
 * DEV-only failure telemetry. This is intentionally a server log rather than
 * an audit/database record so it cannot alter media lifecycle state.
 */
export function logStudioVideoStorageDeleteFailure(
  error: unknown,
  leaseLost: boolean,
): void {
  if (process.env.NODE_ENV !== "development") return;

  const diagnostic = getAttachedStudioVideoStorageDeleteDiagnostic(error)
    ?? getStudioVideoStorageDeleteDiagnostic(error);
  console.warn("[StudioVideoStorageDeleteDiagnostic]", {
    ...diagnostic,
    leaseStatus: leaseLost ? "lost" : "valid",
  });
}

/**
 * Produces one DEV-safe diagnostic event for the manual video deletion path.
 * It intentionally excludes storage keys, media/transcript content, URLs,
 * credentials, IP addresses, and account identifiers.
 */
export function getStudioVideoDeletionFailureDiagnostic(input: {
  failureStage: StudioVideoDeletionFailureStage;
  requestId: unknown;
  httpOutcome: number;
  leaseStatus: StudioVideoDeletionFailureDiagnostic["leaseStatus"];
  storageDeletionCompleted: boolean;
  error?: unknown;
}): StudioVideoDeletionFailureDiagnostic {
  const storageDiagnostic = input.error === undefined
    ? undefined
    : getAttachedStudioVideoStorageDeleteDiagnostic(input.error)
      ?? getStudioVideoStorageDeleteDiagnostic(input.error);
  const httpOutcome = safeStatus(input.httpOutcome) ?? 500;

  return {
    failureStage: input.failureStage,
    requestId: safeRequestId(input.requestId),
    httpOutcome,
    leaseStatus: input.leaseStatus,
    storageDeletionCompleted: input.storageDeletionCompleted,
    ...(storageDiagnostic
      ? {
          sdkErrorClass: storageDiagnostic.sdkErrorClass,
          ...(storageDiagnostic.statusCode !== undefined
            ? { sdkStatus: storageDiagnostic.statusCode }
            : {}),
        }
      : {}),
  };
}

/**
 * DEV-only deletion-stage telemetry. This is a server log only, so it cannot
 * change the media lifecycle or retain sensitive content.
 */
export function logStudioVideoDeletionFailure(input: {
  failureStage: StudioVideoDeletionFailureStage;
  requestId: unknown;
  httpOutcome: number;
  leaseStatus: StudioVideoDeletionFailureDiagnostic["leaseStatus"];
  storageDeletionCompleted: boolean;
  error?: unknown;
}): void {
  if (process.env.NODE_ENV !== "development") return;
  console.warn(
    "[StudioVideoDeletionDiagnostic]",
    getStudioVideoDeletionFailureDiagnostic(input),
  );
}