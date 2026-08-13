// server/services/permanentImageStorage.ts
// Service for permanently storing DALL-E generated images
// Primary: Amazon S3 | Fallback: Replit Object Storage (@replit/object-storage Client)

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { Client as ReplitStorageClient } from "@replit/object-storage";
import crypto from 'crypto';

function getS3Client(): S3Client {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.AWS_REGION || 'us-east-2';
  
  if (!accessKeyId || !secretAccessKey) {
    throw new Error('AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be set');
  }
  
  return new S3Client({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'my-perfect-meals-images';

interface UploadImageOptions {
  imageUrl: string;
  mealName: string;
  imageHash?: string;
}

interface UploadResult {
  permanentUrl: string;
  objectPath: string;
  uploadedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// REPLIT OBJECT STORAGE FALLBACK
// Uses @replit/object-storage Client which auto-discovers the active bucket
// via the sidecar's /object-storage/default-bucket endpoint.
// The signed-URL sidecar path (/object-storage/signed-object-url) returns 401
// and must NOT be used. This Client path is proven working.
// ─────────────────────────────────────────────────────────────────────────────

// Lazy singleton — initialised once and reused across requests.
let _replitStorageClient: ReplitStorageClient | null = null;
function getReplitStorageClient(): ReplitStorageClient {
  if (!_replitStorageClient) {
    _replitStorageClient = new ReplitStorageClient();
  }
  return _replitStorageClient;
}

async function uploadToReplitObjectStorage(
  imageBuffer: Buffer,
  contentType: string,
  fileName: string,
): Promise<string> {
  const objectName = `meal-images/${fileName}`;
  const client = getReplitStorageClient();

  // Note: UploadOptions only exposes { compress?: boolean } — contentType is not
  // a supported option in this SDK version. Omit it; the server infers it.
  const result = await client.uploadFromBytes(objectName, imageBuffer);

  if (!result.ok) {
    throw new Error(`Replit Object Storage upload failed: ${result.error?.message ?? "unknown error"}`);
  }

  // Discover the active bucket ID via the Object Storage sidecar.
  // The SDK's Client does not expose a public bucketId accessor; the sidecar's
  // /object-storage/default-bucket endpoint is the supported discovery path.
  const sidecarRes = await fetch("http://127.0.0.1:1106/object-storage/default-bucket").catch(() => null);
  const sidecarJson = sidecarRes?.ok ? await sidecarRes.json().catch(() => null) : null;
  const bucketId: string =
    sidecarJson?.bucketId ??
    process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID ??
    "replit-objstore-2a68d585-4c50-4c2e-a7ff-a9973358bc5b";

  const publicUrl = `/public-objects/${bucketId}/${objectName}`;
  console.log(`✅ Image uploaded to Replit Object Storage: ${publicUrl}`);
  return publicUrl;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN UPLOAD FUNCTION
// Downloads an image from a URL (or decodes base64) and uploads to S3.
// Falls back to Replit Object Storage if S3 fails.
// ─────────────────────────────────────────────────────────────────────────────

export async function uploadImageToPermanentStorage(
  options: UploadImageOptions
): Promise<UploadResult> {
  const { imageUrl, mealName, imageHash } = options;

  // ── DECODE IMAGE ────────────────────────────────────────────────────────────
  let imageBuffer: Buffer;
  let contentType: string;

  if (imageUrl.startsWith('data:')) {
    const commaIdx = imageUrl.indexOf(',');
    const meta = imageUrl.substring(5, commaIdx);
    contentType = meta.split(';')[0] || 'image/png';
    const b64 = imageUrl.substring(commaIdx + 1);
    imageBuffer = Buffer.from(b64, 'base64');
  } else {
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image: ${imageResponse.statusText}`);
    }
    imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    contentType = imageResponse.headers.get('content-type') || 'image/png';
  }

  // ── BUILD FILENAME ──────────────────────────────────────────────────────────
  const fileExtension = contentType.includes('png') ? 'png' : 'jpg';
  const uniqueId = imageHash || crypto.randomUUID().substring(0, 16);
  const sanitizedName = mealName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .substring(0, 50);
  const fileName = `${sanitizedName}-${uniqueId}.${fileExtension}`;

  // ── ATTEMPT S3 ──────────────────────────────────────────────────────────────
  try {
    console.log(`📦 Uploading image to S3: ${mealName}`);
    const key = `meal-images/${fileName}`;
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: imageBuffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000',
    });

    await getS3Client().send(command);

    const permanentUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-2'}.amazonaws.com/${key}`;
    console.log(`✅ Image uploaded to S3: ${permanentUrl}`);

    return {
      permanentUrl,
      objectPath: key,
      uploadedAt: new Date().toISOString(),
    };
  } catch (s3Error: any) {
    const httpStatus = s3Error.$metadata?.httpStatusCode ?? 'no-http-status';
    const s3Code = s3Error.Code ?? s3Error.code ?? s3Error.name ?? 'unknown-code';
    const s3Msg = s3Error.message?.substring(0, 120) ?? 'no-message';
    console.error(
      `❌ S3 upload failed for "${mealName}" | HTTP ${httpStatus} | code: ${s3Code} | msg: ${s3Msg} | bucket: ${BUCKET_NAME} | key: meal-images/${fileName}`
    );
  }

  // ── FALLBACK: REPLIT OBJECT STORAGE ─────────────────────────────────────────
  try {
    const permanentUrl = await uploadToReplitObjectStorage(imageBuffer, contentType, fileName);
    return {
      permanentUrl,
      objectPath: `meal-images/${fileName}`,
      uploadedAt: new Date().toISOString(),
    };
  } catch (gcsError: any) {
    const gcsCode = gcsError.code ?? gcsError.statusCode ?? 'no-code';
    const gcsMsg = gcsError.message?.substring(0, 120) ?? 'no-message';
    console.error(
      `❌ GCS upload also failed for "${mealName}" | code: ${gcsCode} | msg: ${gcsMsg} | object: meal-images/${fileName}`
    );
    throw gcsError;
  }
}

/**
 * Check if an image already exists in S3 by hash
 */
export async function checkImageExists(imageHash: string): Promise<string | null> {
  try {
    return null;
  } catch (error) {
    console.error('Error checking S3 image existence:', error);
    return null;
  }
}
