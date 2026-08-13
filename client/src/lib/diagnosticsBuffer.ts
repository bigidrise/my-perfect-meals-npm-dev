/**
 * diagnosticsBuffer.ts — in-memory bounded ring buffer for recent diagnostic events.
 *
 * Populated by:
 *   - GlobalErrorBoundary.componentDidCatch / setupGlobalErrorHandling handlers
 *   - apiRequest() on non-2xx responses
 *
 * Rules (from advisor):
 *   - Max 15 errors, max 15 failed API requests. Oldest entries drop off first.
 *   - Never store: request/response bodies, auth headers/tokens/cookies, passwords,
 *     payment data, medical/chat/meal contents, or sensitive query parameters.
 *   - API entries: method + sanitized path + status + timestamp + duration (if available).
 *   - Error entries: message (max 300 chars) + sanitized first-3-lines of stack.
 *   - In-memory only — never written to localStorage or IndexedDB.
 */

const MAX_ERRORS   = 15;
const MAX_REQUESTS = 15;

export interface DiagnosticError {
  message:         string;   // truncated at 300 chars
  stack?:          string;   // first 3 lines only, source location when available
  source?:         string;   // component name / filename if captured
  timestamp:       string;   // ISO
  /** True when the error originates from Vite/HMR or Replit preview
   *  infrastructure — not from application code. The Developer Summary
   *  treats these as lower-priority than real app errors. */
  isInfrastructure?: boolean;
}

export interface DiagnosticRequest {
  method:     string;  // GET, POST, etc.
  path:       string;  // sanitized — no sensitive query params
  status:     number;
  duration?:  number;  // ms, when available
  timestamp:  string;  // ISO
}

// Module-level state — intentionally NOT exported so only push/snapshot fns touch it.
let _errors:   DiagnosticError[]   = [];
let _requests: DiagnosticRequest[] = [];

// ── Sanitization helpers ──────────────────────────────────────────────────────

/**
 * Strip sensitive query parameters from a URL/path.
 * Strips the entire param rather than masking the value —
 * per advisor requirement: "strip rather than merely masking."
 */
const SENSITIVE_PARAM_PATTERNS = [
  /token/i, /key/i, /secret/i, /auth/i, /password/i, /passwd/i,
  /credential/i, /session/i, /cookie/i, /sig/i, /signature/i,
  /access_token/i, /refresh_token/i, /api_key/i,
];

export function sanitizePath(rawUrl: string): string {
  try {
    // Handle relative paths by prepending a dummy origin
    const absolute = rawUrl.startsWith("http") ? rawUrl : `https://x${rawUrl}`;
    const u = new URL(absolute);
    const clean = new URLSearchParams();
    u.searchParams.forEach((value, key) => {
      const sensitive = SENSITIVE_PARAM_PATTERNS.some(r => r.test(key));
      if (!sensitive) clean.set(key, value);
    });
    const qs = clean.toString();
    return u.pathname + (qs ? `?${qs}` : "");
  } catch {
    // Fallback: strip everything after ?
    return rawUrl.split("?")[0];
  }
}

/** Truncate stack to first 3 lines and clamp each line's length */
function sanitizeStack(stack: string | undefined): string | undefined {
  if (!stack) return undefined;
  return stack
    .split("\n")
    .slice(0, 3)
    .map(line => line.trim().slice(0, 200))
    .join("\n");
}

// ── Infrastructure noise detection ───────────────────────────────────────────

/**
 * Patterns that identify Vite/HMR/Replit-preview infrastructure errors.
 * These are captured for completeness but deprioritised in the Developer
 * Diagnostic Summary so they don't overshadow real application errors.
 */
const INFRASTRUCTURE_MESSAGE_PATTERNS = [
  /websocket closed without opened/i,
  /\[vite\]/i,
  /hmr\s+(update|disconnect|reconnect|connect)/i,
  /vite.*hmr/i,
];

const INFRASTRUCTURE_STACK_PATTERNS = [
  /@vite\/client/i,
  /vite\/dist\/client/i,
  /replit\.dev\/@vite\//i,
];

function detectInfrastructure(msg: string, stack: string | undefined): boolean {
  if (INFRASTRUCTURE_MESSAGE_PATTERNS.some(r => r.test(msg))) return true;
  if (stack && INFRASTRUCTURE_STACK_PATTERNS.some(r => r.test(stack))) return true;
  return false;
}

// ── Public push API ───────────────────────────────────────────────────────────

export function pushError(
  error: Error | unknown,
  source?: string,
): void {
  const err = error instanceof Error ? error : new Error(String(error));
  const message   = err.message.slice(0, 300);
  const stack     = sanitizeStack(err.stack);
  const entry: DiagnosticError = {
    message,
    stack,
    source,
    timestamp:       new Date().toISOString(),
    isInfrastructure: detectInfrastructure(message, err.stack),
  };
  _errors = [entry, ..._errors].slice(0, MAX_ERRORS);
}

export function pushFailedRequest(
  method: string,
  url: string,
  status: number,
  duration?: number,
): void {
  const entry: DiagnosticRequest = {
    method:    method.toUpperCase(),
    path:      sanitizePath(url),
    status,
    duration,
    timestamp: new Date().toISOString(),
  };
  _requests = [entry, ..._requests].slice(0, MAX_REQUESTS);
}

// ── Snapshot (call at submission time) ───────────────────────────────────────

export interface DiagnosticsSnapshot {
  errors:         DiagnosticError[];
  failedRequests: DiagnosticRequest[];
  capturedAt:     string;
}

export function snapshotDiagnostics(): DiagnosticsSnapshot {
  // Deep-copy so callers cannot mutate buffer entries via the returned snapshot.
  return {
    errors:         _errors.map(e => ({ ...e })),
    failedRequests: _requests.map(r => ({ ...r })),
    capturedAt:     new Date().toISOString(),
  };
}

/** Reset — used in tests only */
export function _resetDiagnosticsBuffer(): void {
  _errors   = [];
  _requests = [];
}
