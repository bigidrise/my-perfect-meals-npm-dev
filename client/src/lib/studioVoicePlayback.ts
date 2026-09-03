import { apiUrl } from "@/lib/resolveApiBase";

type VoicePlaybackMetadata = {
  url?: string;
  pending?: boolean;
  privatePlayback?: boolean;
};

export class StudioVoicePlaybackError extends Error {
  constructor(message: string, public readonly pending = false) {
    super(message);
    this.name = "StudioVoicePlaybackError";
  }
}

export type StudioVoicePlaybackSource = {
  url: string;
  revoke: () => void;
};

async function getPlaybackFailureMessage(response: Pick<Response, "json">): Promise<string> {
  try {
    const payload = await response.json() as { error?: unknown } | null;
    return typeof payload?.error === "string" && payload.error.trim().length > 0
      ? payload.error
      : "Could not load audio";
  } catch {
    return "Could not load audio";
  }
}

/**
 * Fetches metadata for every play so short-lived private stream tokens are
 * never cached. Private audio is fetched with the normal auth headers and
 * converted to an in-memory media URL, which also works in native shells where
 * an HTMLAudioElement cannot attach x-auth-token itself.
 */
export async function loadStudioVoicePlayback(
  metadataPath: string,
  authHeaders: HeadersInit,
  fetchImpl: typeof fetch = fetch,
): Promise<StudioVoicePlaybackSource> {
  const metadataResponse = await fetchImpl(apiUrl(metadataPath), {
    headers: authHeaders,
    credentials: "include",
    cache: "no-store",
  });
  if (!metadataResponse.ok) {
    throw new StudioVoicePlaybackError(await getPlaybackFailureMessage(metadataResponse));
  }

  const metadata = await metadataResponse.json() as VoicePlaybackMetadata;
  if (metadata.pending) {
    throw new StudioVoicePlaybackError("Still transcribing — try again in a moment", true);
  }
  if (!metadata.url) {
    throw new StudioVoicePlaybackError("Could not load audio");
  }

  if (!metadata.privatePlayback) {
    return { url: metadata.url, revoke: () => undefined };
  }

  const streamResponse = await fetchImpl(apiUrl(metadata.url), {
    headers: authHeaders,
    credentials: "include",
    cache: "no-store",
  });
  if (!streamResponse.ok) {
    throw new StudioVoicePlaybackError(await getPlaybackFailureMessage(streamResponse));
  }

  const objectUrl = URL.createObjectURL(await streamResponse.blob());
  return {
    url: objectUrl,
    revoke: () => URL.revokeObjectURL(objectUrl),
  };
}