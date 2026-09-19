const SESSION_EXPIRED_MESSAGE = "Your session has expired. Please sign in again to continue.";

export function handleDefinitiveAuthFailure(
  response: Pick<Response, "status">,
  payload: { code?: unknown; error?: unknown } = {},
): boolean {
  if (response.status !== 401) return false;

  const code = typeof payload.code === "string" ? payload.code : "";
  const error = typeof payload.error === "string" ? payload.error.toLowerCase() : "";
  const isAuthenticationFailure =
    code === "AUTH_REQUIRED" ||
    code === "SESSION_IDLE_TIMEOUT" ||
    code === "AUTH_REAUTHENTICATION_REQUIRED" ||
    error.includes("authentication required") ||
    error.includes("session has expired");

  if (!isAuthenticationFailure) return false;

  window.dispatchEvent(new CustomEvent("mpm:polling-auth-rejected", {
    detail: { reason: "session_expired", message: SESSION_EXPIRED_MESSAGE },
  }));
  return true;
}

export { SESSION_EXPIRED_MESSAGE };