import { useRef } from "react";

export function useChefVoice() {
  const audioQueue = useRef<Blob[]>([]);
  const isPlaying = useRef(false);

  async function speak(text: string) {
    if (!text) return;

    try {
      const apiKey = process.env.ELEVENLABS_API_KEY;
      if (!apiKey) {
        console.warn("⚠️ ElevenLabs API key missing");
        return;
      }

      const response = await fetch(
        "https://api.elevenlabs.io/v1/text-to-speech/ErXwobaYiN019PkySvjV/stream",
        {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text,
            voice_settings: {
              stability: 0.3,
              similarity_boost: 0.8,
            },
          }),
        },
      );

      const reader = response.body.getReader();
      const chunks = [];

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      const audioBlob = new Blob(chunks, { type: "audio/mpeg" });
      audioQueue.current.push(audioBlob);

      playQueue();
    } catch (error) {
      console.error("TTS Error:", error);
    }
  }

  async function playQueue() {
    if (isPlaying.current) return;
    if (audioQueue.current.length === 0) return;

    isPlaying.current = true;
    const blob = audioQueue.current.shift();
    const url = URL.createObjectURL(blob);

    const audio = new Audio(url);
    audio.onended = () => {
      isPlaying.current = false;
      playQueue();
    };

    audio.play();
  }

  return { speak };
}
