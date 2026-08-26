import { apiUrl } from "@/lib/resolveApiBase";

type VideoPlaybackMetadata = {
  url?: string;
  mimeType?: string;
};

export class StudioVideoPlaybackError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StudioVideoPlaybackError";
  }
}

export type StudioVideoPlaybackSource = {
  url: string;
  revoke: () => void;
};

/**
 * Private Studio video streams are authorized by a short-lived playback URL.
 * Fetching that stream into a blob keeps the video element origin-safe in a
 * bundled Capacitor app, where it cannot attach the normal auth headers itself.
 */
export async function loadStudioVideoPlayback(
  metadataPath: string,
  authHeaders: HeadersInit,
  fetchImpl: typeof fetch = fetch,
): Promise<StudioVideoPlaybackSource> {
  const metadataResponse = await fetchImpl(apiUrl(metadataPath), {
    headers: authHeaders,
    credentials: "include",
    cache: "no-store",
  });
  if (!metadataResponse.ok) {
    throw new StudioVideoPlaybackError("Could not load video");
  }

  const metadata = await metadataResponse.json() as VideoPlaybackMetadata;
  if (!metadata.url) {
    throw new StudioVideoPlaybackError("Could not load video");
  }

  const streamResponse = await fetchImpl(apiUrl(metadata.url), {
    headers: authHeaders,
    credentials: "include",
    cache: "no-store",
  });
  if (!streamResponse.ok) {
    throw new StudioVideoPlaybackError("Could not load video");
  }

  const blob = await streamResponse.blob();
  const playbackMimeType =
    blob.type ||
    metadata.mimeType ||
    streamResponse.headers?.get("content-type") ||
    "video/mp4";
  const objectUrl = URL.createObjectURL(
    blob.type ? blob : new Blob([blob], { type: playbackMimeType }),
  );
  return {
    url: objectUrl,
    revoke: () => URL.revokeObjectURL(objectUrl),
  };
}