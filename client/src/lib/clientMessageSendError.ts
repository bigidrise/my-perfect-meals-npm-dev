/** Deliberately do not display arbitrary backend errors (SQL, storage or PHI). */
export async function clientMessageSendError(response: Response): Promise<string> {
  const body = await response.json().catch(() => null);
  if (response.status === 401) return "Your session could not be verified. Sign in again before retrying. Your draft has been kept.";
  if (response.status === 403 && body?.code === "CSRF_TOKEN_INVALID") {
    return "Your security check expired. Refresh this page after copying your draft, then try again.";
  }
  if (response.status === 403 || response.status === 404) {
    return "Your provider conversation is not currently available. Your draft has been kept. Retry after your connection is restored.";
  }
  if (response.status === 413) return "This recording is too large. Keep it shorter and try again.";
  if (response.status === 422) return "This message could not be sent under the messaging content policy. Edit it before trying again.";
  if (response.status === 429) return "Messages are being sent too quickly. Wait a moment, then retry.";
  if (response.status === 400) return "The message or recording could not be accepted. Check it and try again.";
  return "The message could not be sent. Your draft has been kept. Please try again.";
}
