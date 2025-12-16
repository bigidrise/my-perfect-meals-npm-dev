// This file is not used in Express-based apps.
// The actual TTS endpoint is in server/routes.ts at /api/tts
// Keeping this empty file to prevent import errors if referenced elsewhere.

export default function ttsPlaceholder() {
  return new Response(JSON.stringify({ error: "Use /api/tts server endpoint" }), {
    status: 410,
  });
}