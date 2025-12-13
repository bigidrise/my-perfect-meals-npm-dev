// server/services/permanentImageStorage.ts
// Service for permanently storing DALL-E generated images to Replit Object Storage

import { objectStorageClient } from '../objectStorage';
import { setObjectAclPolicy } from '../objectAcl';
import crypto from 'crypto';

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
 * Downloads an image from a URL and uploads it to permanent storage
 */
export async function uploadImageToPermanentStorage(
  options: UploadImageOptions
): Promise<UploadResult> {
  const { imageUrl, mealName, imageHash } = options;

  try {
    console.log(`📦 Uploading image to permanent storage: ${mealName}`);

    // Download the image from DALL-E's temporary URL
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image: ${imageResponse.statusText}`);
    }

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    const contentType = imageResponse.headers.get('content-type') || 'image/png';

    // Generate a unique filename using hash or random ID
    const fileExtension = contentType.includes('png') ? 'png' : 'jpg';
    const uniqueId = imageHash || crypto.randomUUID();
    const sanitizedName = mealName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .substring(0, 50);
    const filename = `meal-images/${sanitizedName}-${uniqueId}.${fileExtension}`;

    // Get the storage bucket from environment variable
    const bucketPath = process.env.PUBLIC_OBJECT_SEARCH_PATHS?.split(',')[0];
    if (!bucketPath) {
      throw new Error('PUBLIC_OBJECT_SEARCH_PATHS not configured');
    }

    const bucketName = bucketPath.split('/')[1];
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(filename);

    // Upload the image buffer to storage
    await file.save(imageBuffer, {
      metadata: {
        contentType,
        cacheControl: 'public, max-age=31536000', // Cache for 1 year
      },
    });

    // Set ACL policy to make it publicly accessible
    await setObjectAclPolicy(file, {
      owner: 'system',
      visibility: 'public',
    });

    // Make the file publicly readable
    await file.makePublic();

    // Generate the public URL
    const permanentUrl = `/public-objects/${filename}`;
    
    console.log(`✅ Image uploaded successfully: ${permanentUrl}`);

    return {
      permanentUrl,
      objectPath: `/${bucketName}/${filename}`,
      uploadedAt: new Date().toISOString(),
    };

  } catch (error: any) {
    console.error(`❌ Failed to upload image to permanent storage:`, error.message);
    throw error;
  }
}

/**
 * Check if an image already exists in permanent storage by hash
 */
export async function checkImageExists(imageHash: string): Promise<string | null> {
  try {
    const bucketPath = process.env.PUBLIC_OBJECT_SEARCH_PATHS?.split(',')[0];
    if (!bucketPath) {
      return null;
    }

    const bucketName = bucketPath.split('/')[1];
    const bucket = objectStorageClient.bucket(bucketName);

    // Search for files with this hash
    const [files] = await bucket.getFiles({
      prefix: 'meal-images/',
    });

    const matchingFile = files.find(file => file.name.includes(imageHash));
    if (matchingFile) {
      const filename = matchingFile.name;
      return `/public-objects/${filename}`;
    }

    return null;
  } catch (error) {
    console.error('Error checking image existence:', error);
    return null;
  }
}
