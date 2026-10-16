type TraceStage = "server" | "hook" | "sidebar" | "portal";

interface UnreadTrace {
  count?: unknown;
  clients?: number;
  status?: number;
  accepted?: boolean;
  current?: boolean;
  cacheHit?: boolean;
  studioResolved?: boolean;
  portalVisible?: boolean;
  indicatorOn?: boolean;
}

/** Temporary diagnostic. Strict allowlist: never log response bodies or identities. */
export function traceProUnreadCount(stage: TraceStage, input: UnreadTrace): void {
  const fields: Record<string, string | number | boolean | null> = {
    stage,
    count: typeof input.count === "number" && Number.isFinite(input.count) ? input.count : null,
    countType: typeof input.count,
  };
  for (const key of ["clients", "status"] as const) {
    if (Number.isSafeInteger(input[key]) && input[key]! >= 0) fields[key] = input[key]!;
  }
  for (const key of ["accepted", "current", "cacheHit", "studioResolved", "portalVisible", "indicatorOn"] as const) {
    if (typeof input[key] === "boolean") fields[key] = input[key]!;
  }
  console.info("[ProUnreadTrace]", fields);
}
