import { developmentProUnreadAuthorizationEnabled } from "@/features/proUnreadFlag";

type Stage = "hook" | "sidebar" | "portalResponse" | "portal";
const snapshots: Partial<Record<Stage, Record<string, number | boolean | null>>> = {};

/** Temporary, memory-only diagnostic. Never accepts identities or message text. */
export function traceDevelopmentUnread(stage: Stage, input: Record<string, unknown>): void {
  if (!developmentProUnreadAuthorizationEnabled) return;
  const safe: Record<string, number | boolean | null> = {};
  for (const key of ["count", "request", "status", "clientGroups", "highlightedClients"]) {
    if (key in input) safe[key] = typeof input[key] === "number" && Number.isFinite(input[key])
      ? input[key] as number : null;
  }
  for (const key of ["accepted", "current", "visible", "indicatorOn", "mounted", "authReady", "desktopViewport"]) {
    if (typeof input[key] === "boolean") safe[key] = input[key] as boolean;
  }
  snapshots[stage] = safe;
  // Include the latest rendered states on every response so an unchanged zero
  // remains observable even if the original mount log has left browser scrollback.
  console.info("[StudioUnreadTrace]", { stage, snapshot: { ...snapshots } });
}

export function developmentUnreadRequest(response: Response): number | undefined {
  const raw = response.headers?.get?.("X-Development-Unread-Trace");
  if (!raw) return undefined;
  const request = Number(raw);
  return Number.isSafeInteger(request) && request > 0 ? request : undefined;
}
