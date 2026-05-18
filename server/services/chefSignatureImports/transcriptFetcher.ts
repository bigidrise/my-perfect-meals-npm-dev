// server/services/chefSignatureImports/transcriptFetcher.ts
// Fetches the auto-generated or manual caption transcript for a YouTube video.
// Uses the youtube-transcript package (no API key required — uses YouTube's public captions).
//
// IMPORTANT: This only retrieves text that YouTube makes publicly accessible.
// No audio/video content is downloaded or stored.

export type TranscriptResult = {
  text: string;
  segmentCount: number;
  truncated: boolean;
};

// Max characters we store for a transcript — keeps DB rows reasonable
const MAX_TRANSCRIPT_CHARS = 12_000;

export async function fetchTranscript(videoId: string): Promise<TranscriptResult> {
  let YoutubeTranscript: any;
  try {
    const mod = await import("youtube-transcript");
    YoutubeTranscript = mod.YoutubeTranscript ?? mod.default;
  } catch {
    throw new Error("youtube-transcript package is not installed. Run: npm install youtube-transcript");
  }

  let segments: Array<{ text: string }> = [];
  try {
    segments = await YoutubeTranscript.fetchTranscript(videoId, { lang: "en" });
  } catch {
    // Fallback: try without language filter
    segments = await YoutubeTranscript.fetchTranscript(videoId);
  }

  if (!segments || segments.length === 0) {
    throw new Error(`No transcript available for video: ${videoId}`);
  }

  const fullText = segments.map(s => s.text).join(" ").replace(/\s+/g, " ").trim();
  const truncated = fullText.length > MAX_TRANSCRIPT_CHARS;
  const text = truncated ? fullText.slice(0, MAX_TRANSCRIPT_CHARS) + "…" : fullText;

  return {
    text,
    segmentCount: segments.length,
    truncated,
  };
}
