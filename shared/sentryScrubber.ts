/**
 * A deliberately dependency-free, conservative privacy boundary for telemetry.
 * It returns a copy, never changes the object supplied by the application.
 */
export const SENTRY_REDACTED = "[REDACTED]";

const MAX_DEPTH = 8;
const MAX_STRING_LENGTH = 2_000;
const MAX_ARRAY_LENGTH = 50;
const MAX_OBJECT_KEYS = 50;
const MAX_NODES = 500;

const SENSITIVE_KEY = /(?:authorization|cookie|token|password|passcode|secret|api\s*[_-]?\s*key|reset|session|otp|pin|glucose|medication|condition|allerg|pregnan|clinical|health|free[_ -]?text|notes?|email|identity)/i;
const SENSITIVE_VALUE = /(?:bearer\s+\S+|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|(?:authorization|cookie|token|password|passcode|secret|api\s*[_-]?\s*key|reset|session|otp|pin)\s*[:=]|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?:glucose|medications?|conditions?|allerg(?:y|ies)|pregnan(?:cy|t)|diabet\w*|clinical|health|notes?|patient)\b)/i;

function safePath(value: string): string {
  try {
    // A relative URL is common in browser breadcrumbs.
    const parsed = new URL(value, "https://telemetry.invalid");
    return parsed.pathname || "/";
  } catch {
    return value.split(/[?#]/, 1)[0] || "/";
  }
}

function scrubString(value: string): string {
  if (SENSITIVE_VALUE.test(value)) return SENTRY_REDACTED;
  return value.length > MAX_STRING_LENGTH
    ? `${value.slice(0, MAX_STRING_LENGTH)}…[TRUNCATED]`
    : value;
}

/**
 * Recursively sanitizes arbitrary telemetry payloads. Keys that describe
 * credentials, PHI, or free-form notes are retained only with a redacted value
 * so debugging shape remains useful without transmitting their contents.
 */
export function scrubSentryData(value: unknown): unknown {
  return scrub(value, 0, { seen: new WeakSet<object>(), nodes: 0 });
}

interface ScrubState {
  seen: WeakSet<object>;
  nodes: number;
}

function scrub(value: unknown, depth: number, state: ScrubState): unknown {
  state.nodes += 1;
  if (state.nodes > MAX_NODES) return "[MAX_SIZE]";
  if (typeof value === "string") return scrubString(value);
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "bigint") return String(value);
  if (typeof value === "undefined") return undefined;
  if (typeof value === "function" || typeof value === "symbol") return `[${typeof value}]`;
  if (depth >= MAX_DEPTH) return "[MAX_DEPTH]";

  if (value instanceof Error) {
    return {
      name: scrubString(value.name),
      message: scrubString(value.message),
      stack: typeof value.stack === "string" ? scrubString(value.stack) : undefined,
    };
  }

  if (typeof value !== "object") return SENTRY_REDACTED;
  if (state.seen.has(value)) return "[CIRCULAR]";
  state.seen.add(value);

  if (Array.isArray(value)) {
    const result = value.slice(0, MAX_ARRAY_LENGTH).map((item) => scrub(item, depth + 1, state));
    if (value.length > MAX_ARRAY_LENGTH) result.push("[TRUNCATED]");
    return result;
  }

  const result: Record<string, unknown> = {};
  let count = 0;
  for (const key of Object.keys(value)) {
    if (count++ >= MAX_OBJECT_KEYS) {
      result["[TRUNCATED]"] = `${Object.keys(value).length - MAX_OBJECT_KEYS} keys omitted`;
      break;
    }
    const entry = (value as Record<string, unknown>)[key];
    if (SENSITIVE_KEY.test(key)) {
      result[key] = SENTRY_REDACTED;
    } else if (key.toLowerCase() === "url" && typeof entry === "string") {
      result[key] = safePath(entry);
    } else {
      result[key] = scrub(entry, depth + 1, state);
    }
  }
  return result;
}

/**
 * Sentry event policy: preserve diagnostic routing metadata, while removing
 * request payloads and all raw user identity fields.
 */
const SAFE_DIAGNOSTIC_KEYS = new Set([
  "requestId", "request_id", "method", "path", "status", "statusCode",
  "status_code", "component", "operation", "outcome", "attempts",
]);

function safeIdentifier(value: unknown): unknown {
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value !== "string") return undefined;
  if (!/^[A-Za-z0-9_./:-]{1,128}$/.test(value)) return SENTRY_REDACTED;
  return scrubString(value);
}

function safeDiagnostics(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!SAFE_DIAGNOSTIC_KEYS.has(key)) continue;
    output[key] = key === "path" && typeof entry === "string"
      ? safePath(entry)
      : safeIdentifier(entry);
  }
  return Object.keys(output).length > 0 ? output : undefined;
}

export function scrubSentryEvent<T>(event: T): T {
  const scrubbed = scrubSentryData(event) as Record<string, unknown>;
  if (!scrubbed || typeof scrubbed !== "object") return scrubbed as T;

  const output: Record<string, unknown> = {};
  for (const key of ["event_id", "timestamp", "platform", "level", "logger", "environment", "release", "dist"]) {
    const value = scrubbed[key];
    if (typeof value === "number") output[key] = value;
    else if (typeof value === "string") output[key] = safeIdentifier(value);
  }
  if (typeof scrubbed.transaction === "string") {
    output.transaction = safePath(scrubbed.transaction);
  }
  const rootDiagnostics = safeDiagnostics(scrubbed);
  if (rootDiagnostics) Object.assign(output, rootDiagnostics);

  const request = scrubbed.request;
  if (request && typeof request === "object") {
    const input = request as Record<string, unknown>;
    output.request = {
      ...(typeof input.method === "string" ? { method: safeIdentifier(input.method) } : {}),
      ...(typeof input.url === "string" ? { url: safePath(input.url) } : {}),
      ...(typeof input.status_code === "number" ? { status_code: input.status_code } : {}),
    };
  }

  const exception = scrubbed.exception;
  if (exception && typeof exception === "object") {
    const values = (exception as Record<string, unknown>).values;
    if (Array.isArray(values)) {
      output.exception = {
        values: values.slice(0, 10).map((entry) => {
          const item = entry && typeof entry === "object"
            ? entry as Record<string, unknown>
            : {};
          const mechanism = item.mechanism && typeof item.mechanism === "object"
            ? item.mechanism as Record<string, unknown>
            : undefined;
          return {
            ...(typeof item.type === "string" ? { type: safeIdentifier(item.type) } : {}),
            value: SENTRY_REDACTED,
            ...(mechanism ? {
              mechanism: {
                ...(typeof mechanism.type === "string" ? { type: safeIdentifier(mechanism.type) } : {}),
                ...(typeof mechanism.handled === "boolean" ? { handled: mechanism.handled } : {}),
              },
            } : {}),
          };
        }),
      };
    }
  }

  const extra = safeDiagnostics(scrubbed.extra);
  if (extra) output.extra = extra;

  if (Array.isArray(scrubbed.breadcrumbs)) {
    output.breadcrumbs = scrubbed.breadcrumbs
      .slice(0, MAX_ARRAY_LENGTH)
      .map((breadcrumb) => scrubSentryBreadcrumb(breadcrumb));
  }

  // Explicitly retain an empty user object to prevent SDK integrations from
  // carrying a previously established identity into this event.
  output.user = {};
  return output as T;
}

export function scrubSentryBreadcrumb<T>(breadcrumb: T): T {
  if (!breadcrumb || typeof breadcrumb !== "object") return SENTRY_REDACTED as T;
  const input = breadcrumb as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  for (const key of ["type", "category", "level"]) {
    if (typeof input[key] === "string") output[key] = safeIdentifier(input[key]);
  }
  if (typeof input.timestamp === "number") output.timestamp = input.timestamp;
  if ("message" in input) output.message = SENTRY_REDACTED;
  const data = safeDiagnostics(input.data);
  if (data) output.data = data;
  return output as T;
}