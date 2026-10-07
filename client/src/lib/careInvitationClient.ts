import { apiUrl } from "./resolveApiBase";
import { getAuthHeaders } from "./auth";

/** Keep the structured legal/setup response, using the app's native/cookie transport. */
export function readCareInvitationMetadata(token: string) {
  return fetch(apiUrl(`/api/procare-invite/token/${encodeURIComponent(token)}`), {
    credentials: "include", headers: getAuthHeaders(),
  });
}
export function acceptCareInvitationToken(token: string) {
  return fetch(apiUrl(`/api/procare-invite/token/${encodeURIComponent(token)}/accept`), {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
  });
}
export async function connectCareInvitationCode(code: string) {
  const response = await fetch(apiUrl("/api/care-team/connect"), {
    method: "POST", credentials: "include", body: JSON.stringify({ code }),
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
  });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.message || data.error || "Connection could not be completed."), { invitation: data });
  return data;
}
