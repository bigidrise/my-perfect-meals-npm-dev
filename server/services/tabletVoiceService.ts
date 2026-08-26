import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import "openai/shims/node";
import OpenAI from "openai";
import { toFile } from "openai/uploads";
import { Client as ReplitStorageClient } from "@replit/object-storage";
import { Readable } from "node:stream";
import {
  attachStudioVideoStorageDeleteDiagnostic,
  getStudioVideoStorageDeleteDiagnostic,
} from "./studioVideoStorageDiagnostics";

export const VOICE_BUCKET = process.env.S3_BUCKET_NAME!;
export const VOICE_PREFIX = "tablet-voice";
export const STUDIO_VOICE_PREFIX = "studio-voice";
export const MAX_VOICE_DURATION_SEC = 60;
export const STUDIO_VIDEO_BUCKET = process.env.S3_BUCKET_NAME!;
export const STUDIO_VIDEO_PREFIX = "studio-video";
// Whisper accepts uploads below 25MB; cap slightly below that so every accepted
// message can complete the required transcription/moderation gate.
export const MAX_STUDIO_VIDEO_SIZE_BYTES = 24 * 1024 * 1024;
export const MAX_STUDIO_VIDEO_DURATION_SEC = 120;
export const STUDIO_VOICE_STORAGE_BACKENDS = ["replit", "s3_legacy"] as const;
export type StudioVoiceStorageBackend = typeof STUDIO_VOICE_STORAGE_BACKENDS[number];

let studioMediaStorage: ReplitStorageClient | null = null;
function getStudioMediaStorage(): ReplitStorageClient {
  if (!studioMediaStorage) studioMediaStorage = new ReplitStorageClient();
  return studioMediaStorage;
}

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
  const ext = voiceExtension(mimeType);
  return `${VOICE_PREFIX}/${noteId}.${ext}`;
}

export function normalizeVoiceMimeType(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const mimeType = value.split(";")[0].trim().toLowerCase();
  if ([
    "audio/webm",
    "audio/ogg",
    "audio/mp4",
    "audio/m4a",
    "audio/x-m4a",
    "audio/aac",
    "audio/mpeg",
    "audio/wav",
    "audio/x-wav",
  ].includes(mimeType)) {
    return mimeType;
  }
  return null;
}

export function resolveVoiceStorageBackend(value: unknown): StudioVoiceStorageBackend {
  return value === "replit" ? "replit" : "s3_legacy";
}

function voiceExtension(mimeType: string): string {
  const normalized = normalizeVoiceMimeType(mimeType) ?? mimeType.split(";")[0].trim().toLowerCase();
  if (normalized === "audio/webm") return "webm";
  if (normalized === "audio/ogg") return "ogg";
  if (normalized === "audio/mp4") return "m4a";
  if (normalized === "audio/m4a" || normalized === "audio/x-m4a") return "m4a";
  if (normalized === "audio/aac") return "aac";
  if (normalized === "audio/mpeg") return "mp3";
  if (normalized === "audio/wav" || normalized === "audio/x-wav") return "wav";
  return "webm";
}

export function getStudioVoiceObjectKey(noteId: string, mimeType: string): string {
  return `${STUDIO_VOICE_PREFIX}/${noteId}.${voiceExtension(mimeType)}`;
}

export async function uploadStudioVoiceToPrivateStorage(
  buffer: Buffer,
  mimeType: string,
  objectKey: string,
): Promise<void> {
  const result = await getStudioMediaStorage().uploadFromBytes(objectKey, buffer, { compress: false });
  if (!result.ok) throw new Error(`Private voice upload failed: ${result.error?.message ?? "unknown error"}`);
}

export async function deleteStudioVoiceFromPrivateStorage(objectKey: string): Promise<void> {
  const result = await getStudioMediaStorage().delete(objectKey);
  if (!result.ok) throw new Error(`Private voice deletion failed: ${result.error?.message ?? "unknown error"}`);
}

export function getStudioVoiceStream(objectKey: string): Readable {
  return getStudioMediaStorage().downloadAsStream(objectKey);
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function downloadStudioVoiceFromPrivateStorage(objectKey: string): Promise<Buffer> {
  return streamToBuffer(getStudioVoiceStream(objectKey));
}

export async function downloadVoiceForTranscription(
  objectKey: string,
  backend: StudioVoiceStorageBackend,
): Promise<Buffer> {
  return backend === "replit"
    ? downloadStudioVoiceFromPrivateStorage(objectKey)
    : downloadVoiceFromS3(objectKey);
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

function videoExtension(mimeType: string): string {
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("quicktime")) return "mov";
  if (mimeType.includes("webm")) return "webm";
  return "webm";
}

export function getStudioVideoObjectKey(messageId: string, mimeType: string): string {
  return `${STUDIO_VIDEO_PREFIX}/${messageId}.${videoExtension(mimeType)}`;
}

export async function uploadStudioVideoToS3(
  buffer: Buffer,
  mimeType: string,
  objectKey: string,
): Promise<void> {
  const result = await getStudioMediaStorage().uploadFromBytes(objectKey, buffer, { compress: false });
  if (!result.ok) throw new Error(`Private video upload failed: ${result.error?.message ?? "unknown error"}`);
}

/**
 * Returns a five-minute signed URL. The object remains private in the bucket;
 * callers must never persist or expose this URL as a message field.
 */
export async function getSignedStudioVideoPlaybackUrl(
  objectKey: string,
  mimeType: string,
): Promise<string> {
  throw new Error("Private video playback must be proxied through an authorized Studio route");
}

export async function deleteStudioVideoFromS3(objectKey: string): Promise<void> {
  const storage = getStudioMediaStorage();
  let objectExistedBeforeDelete: boolean | "unknown" = "unknown";

  // This DEV-only preflight is observational: an unavailable exists() call
  // never blocks or changes the following delete attempt.
  if (process.env.NODE_ENV === "development") {
    try {
      const existsResult = await storage.exists(objectKey);
      if (existsResult.ok) objectExistedBeforeDelete = existsResult.value;
    } catch {
      // Preserve the original delete behavior when diagnostics cannot probe.
    }
  }

  let result;
  try {
    result = await storage.delete(objectKey);
  } catch (error) {
    if (error instanceof Error) {
      throw attachStudioVideoStorageDeleteDiagnostic(
        error,
        getStudioVideoStorageDeleteDiagnostic(error, objectExistedBeforeDelete),
      );
    }
    throw error;
  }
  if (result.ok) return;

  const error = new Error(
    `Private video deletion failed: ${result.error?.message ?? "unknown error"}`,
  );
  throw attachStudioVideoStorageDeleteDiagnostic(
    error,
    getStudioVideoStorageDeleteDiagnostic(result.error, objectExistedBeforeDelete),
  );
}

export function getStudioVideoStream(objectKey: string) {
  return getStudioMediaStorage().downloadAsStream(objectKey);
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

/**
 * Delete one private Studio media object. S3 deletion is idempotent: a
 * previously removed object is treated as successfully cleaned up, which
 * makes retries safe after a worker crash or a partial batch failure.
 */
export async function deleteVoiceObjectFromS3(objectKey: string): Promise<void> {
  if (!objectKey || objectKey.trim().length === 0) {
    throw new Error("Storage object key is required");
  }

  const s3 = getS3Client();
  await s3.send(new DeleteObjectCommand({
    Bucket: VOICE_BUCKET,
    Key: objectKey,
  }));
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

  const file = new File([buffer as unknown as BlobPart], `voice-note.${ext}`, { type: mimeType });

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

/**
 * Video messages use the same private transcription provider, but permit the
 * longer Studio-video duration limit. The returned text is retained only in
 * the private message record and is never placed in a notification or list
 * response.
 */
export async function transcribeStudioVideoBuffer(
  buffer: Buffer,
  mimeType: string,
): Promise<{ transcript: string; durationSec: number }> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY required for transcription");
  }
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const ext = mimeType.includes("mp4") ? "mp4"
    : mimeType.includes("quicktime") ? "mov"
    : "webm";
  const file = await toFile(buffer, `studio-video.${ext}`, { type: mimeType });
  const response = await openai.audio.transcriptions.create({
    file,
    model: "whisper-1",
    response_format: "verbose_json",
  }) as any;
  const transcript = (response.text || "").trim();
  const durationSec = Number(response.duration || 0);
  if (durationSec > MAX_STUDIO_VIDEO_DURATION_SEC) {
    throw new Error(`Video message exceeds ${MAX_STUDIO_VIDEO_DURATION_SEC}s limit`);
  }
  return { transcript, durationSec };
}
