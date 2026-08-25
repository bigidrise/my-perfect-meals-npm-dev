export type StudioVideoTranscriptionFailureCategory =
  | "authentication"
  | "configuration"
  | "network"
  | "provider_server"
  | "rate_limit"
  | "timeout"
  | "validation"
  | "unknown";

export type StudioVideoTranscriptionFailureMetadata = {
  provider: "openai";
  failureCategory: StudioVideoTranscriptionFailureCategory;
  sdkErrorClass?: string;
  httpStatus?: number;
  providerRequestId?: string;
  providerErrorType?: string;
};

type ErrorRecord = Record<string, unknown>;

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

function normalizeFailureCategory(
  errorClass: string | undefined,
  status: number | undefined,
  providerErrorType: string | undefined,
  code: string | undefined,
): StudioVideoTranscriptionFailureCategory {
  if (errorClass === "APITimeoutError" || code === "ETIMEDOUT" || code === "UND_ERR_CONNECT_TIMEOUT") {
    return "timeout";
  }
  if (status === 429 || providerErrorType === "rate_limit_error") return "rate_limit";
  if (status === 401 || status === 403 || providerErrorType === "authentication_error") {
    return "authentication";
  }
  if (status === 400 || status === 413 || status === 422 || providerErrorType === "invalid_request_error") {
    return "validation";
  }
  if (status !== undefined && status >= 500) return "provider_server";
  if (errorClass === "APIConnectionError" || code === "ECONNRESET" || code === "ENOTFOUND") {
    return "network";
  }
  if (errorClass === "Error" && code === "OPENAI_API_KEY_REQUIRED") return "configuration";
  return "unknown";
}

/**
 * Produces audit-safe operational diagnostics without retaining provider
 * messages, media data, transcript text, request payloads, or response bodies.
 */
export function getStudioVideoTranscriptionFailureMetadata(
  error: unknown,
): StudioVideoTranscriptionFailureMetadata {
  const record = asErrorRecord(error);
  const errorClass = safeIdentifier(record.name)
    ?? safeIdentifier((error as { constructor?: { name?: unknown } } | null)?.constructor?.name);
  const status = safeStatus(record.status);
  const providerErrorType = safeIdentifier(record.type);
  const code = safeIdentifier(record.code);
  const providerRequestId = safeIdentifier(record.request_id) ?? safeIdentifier(record.requestId);

  return {
    provider: "openai",
    failureCategory: normalizeFailureCategory(errorClass, status, providerErrorType, code),
    ...(errorClass ? { sdkErrorClass: errorClass } : {}),
    ...(status ? { httpStatus: status } : {}),
    ...(providerRequestId ? { providerRequestId } : {}),
    ...(providerErrorType ? { providerErrorType } : {}),
  };
}