import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

const FFMPEG_AUDIO_BITRATE = "48k";
const FFMPEG_AUDIO_SAMPLE_RATE = "16000";

export type StudioVideoAudioExtractionOptions = {
  tempRoot?: string;
  ffmpegPath?: string;
};

function inputExtension(mimeType: string): string {
  if (mimeType === "video/mp4") return "mp4";
  if (mimeType === "video/quicktime") return "mov";
  return "webm";
}

function runFfmpeg(
  inputPath: string,
  outputPath: string,
  ffmpegPath: string,
): Promise<void> {
  const args = [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    inputPath,
    "-map",
    "0:a:0",
    "-vn",
    "-sn",
    "-dn",
    "-ac",
    "1",
    "-ar",
    FFMPEG_AUDIO_SAMPLE_RATE,
    "-c:a",
    "libopus",
    "-b:a",
    FFMPEG_AUDIO_BITRATE,
    "-f",
    "webm",
    outputPath,
  ];

  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let settled = false;
    let stderrBytes = 0;
    child.stderr?.on("data", (chunk: Buffer) => {
      // Drain stderr so FFmpeg cannot block, but do not retain provider or
      // media content in memory or surface it to the client.
      stderrBytes = Math.min(stderrBytes + chunk.length, 4096);
    });
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    child.once("error", () => {
      fail(new Error("Studio video audio extraction is unavailable"));
    });
    child.once("close", (code) => {
      if (settled) return;
      if (code === 0) {
        settled = true;
        resolve();
      } else {
        fail(new Error(`Studio video audio extraction failed (exit ${code ?? "unknown"})`));
      }
    });
  });
}

/**
 * Extracts a small speech-quality audio payload without creating a permanent
 * media object. Both the source video and extracted audio live only in a
 * private OS temp directory, which is removed on every exit path.
 */
export async function extractStudioVideoAudio(
  videoBuffer: Buffer,
  mimeType: string,
  options: StudioVideoAudioExtractionOptions = {},
): Promise<Buffer> {
  const directory = await mkdtemp(join(options.tempRoot ?? tmpdir(), "studio-video-audio-"));
  const inputPath = join(directory, `input.${inputExtension(mimeType)}`);
  const outputPath = join(directory, "transcription.webm");

  try {
    await writeFile(inputPath, videoBuffer, { mode: 0o600 });
    await runFfmpeg(
      inputPath,
      outputPath,
      options.ffmpegPath ?? process.env.FFMPEG_PATH ?? "ffmpeg",
    );
    return await readFile(outputPath);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}