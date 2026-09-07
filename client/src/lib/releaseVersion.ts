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

export function releaseDismissKey(releaseId: string): string | null {
  const normalized = releaseId.trim();
  return normalized ? `mpm_update_dismissed_${normalized}` : null;
}

export function isReleaseAcknowledged(releaseId: string): boolean {
  const key = releaseDismissKey(releaseId);
  return key ? localStorage.getItem(key) === "1" : false;
}

export function acknowledgeRelease(releaseId: string): boolean {
  const key = releaseDismissKey(releaseId);
  if (!key) return false;
  localStorage.setItem(key, "1");
  return true;
}