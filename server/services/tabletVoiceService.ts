import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import OpenAI from "openai";

export const VOICE_BUCKET = process.env.S3_BUCKET_NAME!;
export const VOICE_PREFIX = "tablet-voice";
export const MAX_VOICE_DURATION_SEC = 60;

function getS3Client() {
  return new S3Client({
    region: process.env.AWS_REGION!,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
}

export function getVoiceObjectKey(noteId: string, mimeType: string): string {
  const ext = mimeType.includes("webm") ? "webm"
    : mimeType.includes("mp4") ? "mp4"
    : mimeType.includes("ogg") ? "ogg"
    : "opus";
  return `${VOICE_PREFIX}/${noteId}.${ext}`;
}

export async function uploadVoiceToS3(
  buffer: Buffer,
  mimeType: string,
  objectKey: string
): Promise<void> {
  const s3 = getS3Client();
  await s3.send(new PutObjectCommand({
    Bucket: VOICE_BUCKET,
    Key: objectKey,
    Body: buffer,
    ContentType: mimeType,
  }));
}

export async function getSignedPlaybackUrl(objectKey: string): Promise<string> {
  const s3 = getS3Client();
  const command = new GetObjectCommand({
    Bucket: VOICE_BUCKET,
    Key: objectKey,
  });
  return getSignedUrl(s3, command, { expiresIn: 60 * 20 });
}

export async function downloadVoiceFromS3(objectKey: string): Promise<Buffer> {
  const s3 = getS3Client();
  const response = await s3.send(new GetObjectCommand({
    Bucket: VOICE_BUCKET,
    Key: objectKey,
  }));
  if (!response.Body) throw new Error("Empty S3 response body");
  const chunks: Buffer[] = [];
  for await (const chunk of response.Body as any) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function transcribeVoiceBuffer(
  buffer: Buffer,
  mimeType: string
): Promise<{ transcript: string; durationSec: number }> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY required for transcription");
  }
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const ext = mimeType.includes("webm") ? "webm"
    : mimeType.includes("mp4") ? "mp4"
    : mimeType.includes("ogg") ? "ogg"
    : "m4a";

  const file = new File([buffer], `voice-note.${ext}`, { type: mimeType });

  const response = await openai.audio.transcriptions.create({
    file,
    model: "whisper-1",
    response_format: "verbose_json",
  }) as any;

  const durationSec = Math.round(response.duration || 0);
  const transcript = (response.text || "").trim();

  if (durationSec > MAX_VOICE_DURATION_SEC) {
    throw new Error(`Voice note exceeds ${MAX_VOICE_DURATION_SEC}s limit (actual: ${durationSec}s)`);
  }

  return { transcript, durationSec };
}
