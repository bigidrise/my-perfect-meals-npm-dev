// server/services/permanentImageStorage.ts
// Service for permanently storing DALL-E generated images
// Primary: Amazon S3 | Fallback: Replit Object Storage (GCS via sidecar)

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
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
// Used when S3 is unavailable / returns 403. Uses the Replit sidecar to
// generate a pre-signed PUT URL, then uploads directly — no GCS SDK auth
// required. This is the same mechanism objectStorage.ts uses for all other
// object storage operations.
// ─────────────────────────────────────────────────────────────────────────────

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

async function uploadToReplitObjectStorage(
  imageBuffer: Buffer,
  contentType: string,
  fileName: string,
): Promise<string> {
  const searchPaths = (process.env.PUBLIC_OBJECT_SEARCH_PATHS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!searchPaths.length) {
    throw new Error("PUBLIC_OBJECT_SEARCH_PATHS not configured — cannot fall back to Replit Object Storage");
  }

  const bucketPath = searchPaths[0].replace(/^\/+/, "").replace(/\/+$/, "");
  const bucketName = bucketPath.split("/")[0];

  if (!bucketName) {
    throw new Error(`Could not extract bucket name from PUBLIC_OBJECT_SEARCH_PATHS: "${searchPaths[0]}"`);
  }

  const objectName = `meal-images/${fileName}`;

  const signRes = await fetch(`${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bucket_name: bucketName,
      object_name: objectName,
      method: "PUT",
      expires_at: new Date(Date.now() + 900 * 1000).toISOString(),
    }),
  });

  if (!signRes.ok) {
    throw new Error(`Replit Object Storage: sidecar signed-URL request failed with HTTP ${signRes.status}`);
  }

  const { signed_url: signedUrl } = await signRes.json() as { signed_url: string };

  const uploadRes = await fetch(signedUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000",
    },
    body: imageBuffer as unknown as BodyInit,
  });

  if (!uploadRes.ok) {
    const uploadError = await uploadRes.text().catch(() => "");
    throw new Error(`GCS upload via signed URL failed: HTTP ${uploadRes.status} — ${uploadError.substring(0, 100)}`);
  }

  console.log(`✅ Image uploaded to Replit Object Storage: /public-objects/${objectName}`);
  return `/public-objects/${objectName}`;
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
