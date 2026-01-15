// server/services/permanentImageStorage.ts
// Service for permanently storing DALL-E generated images to Amazon S3

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

/**
 * Downloads an image from a URL and uploads it to S3
 */
export async function uploadImageToPermanentStorage(
  options: UploadImageOptions
): Promise<UploadResult> {
  const { imageUrl, mealName, imageHash } = options;

  try {
    console.log(`📦 Uploading image to S3: ${mealName}`);

    // Download the image from DALL-E's temporary URL
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image: ${imageResponse.statusText}`);
    }

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    const contentType = imageResponse.headers.get('content-type') || 'image/png';

    // Generate a unique filename using hash or random ID
    const fileExtension = contentType.includes('png') ? 'png' : 'jpg';
    const uniqueId = imageHash || crypto.randomUUID().substring(0, 16);
    const sanitizedName = mealName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .substring(0, 50);
    const key = `meal-images/${sanitizedName}-${uniqueId}.${fileExtension}`;

    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: imageBuffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000',
    });

    await getS3Client().send(command);

    // Generate absolute HTTPS URL
    const permanentUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-2'}.amazonaws.com/${key}`;
    
    console.log(`✅ Image uploaded to S3: ${permanentUrl}`);

    return {
      permanentUrl,
      objectPath: key,
      uploadedAt: new Date().toISOString(),
    };

  } catch (error: any) {
    console.error(`❌ Failed to upload image to S3:`, error.message);
    throw error;
  }
}

/**
 * Check if an image already exists in S3 by hash
 */
export async function checkImageExists(imageHash: string): Promise<string | null> {
  try {
    // We can't easily search S3 by partial key, so we construct the expected key pattern
    // and check if any file with this hash exists
    // For now, return null to force regeneration - this is simpler and more reliable
    // Images are cached in memory anyway, so this is only called on cold starts
    return null;
  } catch (error) {
    console.error('Error checking S3 image existence:', error);
    return null;
  }
}
