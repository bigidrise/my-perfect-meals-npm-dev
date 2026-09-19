export function isManifestVersionNewer(
  runningVersion: string,
  manifestVersion: string | null | undefined,
): boolean {
  if (!manifestVersion || runningVersion === "dev") return false;

  const running = Number(runningVersion);
  const manifest = Number(manifestVersion);
  if (!Number.isSafeInteger(running) || !Number.isSafeInteger(manifest)) return false;

  return manifest > running;
}

export interface CustomerReleaseManifest {
  releaseId: string;
  releasedAt: string;
  notes: string[];
}

export function parseCustomerReleaseManifest(value: unknown): CustomerReleaseManifest | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.releaseId !== "string" ||
    !candidate.releaseId.trim() ||
    typeof candidate.releasedAt !== "string" ||
    !candidate.releasedAt.trim() ||
    Number.isNaN(Date.parse(candidate.releasedAt)) ||
    !Array.isArray(candidate.notes)
  ) return null;

  const notes = candidate.notes.filter(
    (note): note is string => typeof note === "string" && note.trim().length > 0,
  ).map((note) => note.trim());
  if (!notes.length || notes.length !== candidate.notes.length) return null;

  return {
    releaseId: candidate.releaseId.trim(),
    releasedAt: candidate.releasedAt,
    notes,
  };
}

export function isDifferentCustomerRelease(
  runningReleaseId: string,
  manifestReleaseId: string,
): boolean {
  const running = runningReleaseId.trim();
  const manifest = manifestReleaseId.trim();
  return Boolean(running && manifest && running !== manifest);
}

export function releaseDismissKey(releaseId: string): string | null {
  const normalized = releaseId.trim();
  return normalized ? `mpm_update_dismissed_${normalized}` : null;
}

export function isReleaseAcknowledged(releaseId: string): boolean {
  const key = releaseDismissKey(releaseId);
  if (!key) return false;
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function acknowledgeRelease(releaseId: string): boolean {
  const key = releaseDismissKey(releaseId);
  if (!key) return false;
  try {
    localStorage.setItem(key, "1");
    return true;
  } catch {
    return false;
  }
}