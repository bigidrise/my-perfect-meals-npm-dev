// server/services/chefSignatureImports/youtubeClient.ts
// Fetches YouTube video metadata via the YouTube Data API v3.
// Requires YOUTUBE_API_KEY environment variable.
//
// OWNERSHIP NOTE:
// - We fetch title, description, channelId, thumbnails — we never store
//   audio/video content. Transcript is fetched separately via youtube-transcript.
// - ownership_confirmed is ALWAYS enforced by the admin, never auto-set.

export type YouTubeVideoMeta = {
  videoId: string;
  title: string;
  description: string;
  channelId: string;
  channelTitle: string;
  publishedAt: string;
  thumbnailUrl: string;
  duration: string;
  tags: string[];
};

function extractVideoId(urlOrId: string): string | null {
  const trimmed = urlOrId.trim();
  // Pure 11-char video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.hostname === "youtu.be") return url.pathname.slice(1);
    if (url.hostname.includes("youtube.com")) {
      return url.searchParams.get("v");
    }
  } catch {
    // not a URL
  }
  return null;
}

export async function fetchYouTubeMeta(urlOrId: string): Promise<YouTubeVideoMeta> {
  const videoId = extractVideoId(urlOrId);
  if (!videoId) throw new Error(`Invalid YouTube URL or video ID: "${urlOrId}"`);

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new Error("YOUTUBE_API_KEY is not configured");

  const endpoint = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${encodeURIComponent(apiKey)}`;
  const resp = await fetch(endpoint);
  if (!resp.ok) {
    throw new Error(`YouTube API error: ${resp.status} ${resp.statusText}`);
  }

  const data = await resp.json() as any;
  const item = data.items?.[0];
  if (!item) throw new Error(`No YouTube video found for ID: ${videoId}`);

  const snippet = item.snippet ?? {};
  const contentDetails = item.contentDetails ?? {};
  const thumbs = snippet.thumbnails ?? {};
  const thumbUrl =
    thumbs.maxres?.url ?? thumbs.high?.url ?? thumbs.medium?.url ?? thumbs.default?.url ?? "";

  return {
    videoId,
    title: snippet.title ?? "",
    description: snippet.description ?? "",
    channelId: snippet.channelId ?? "",
    channelTitle: snippet.channelTitle ?? "",
    publishedAt: snippet.publishedAt ?? "",
    thumbnailUrl: thumbUrl,
    duration: contentDetails.duration ?? "",
    tags: snippet.tags ?? [],
  };
}
