// server/services/imageLifecycle.ts
// Canva-style image lifecycle enforcement
// Ensures all saved entities use permanent first-party image URLs

import { uploadImageToPermanentStorage } from './permanentImageStorage';
import crypto from 'crypto';

// First-party URL prefixes that are always permanent
const S3_BUCKET = process.env.S3_BUCKET_NAME || 'my-perfect-meals-images';
const FIRST_PARTY_PREFIXES = [
  '/public-objects/',  // Replit Object Storage (legacy)
  '/images/',          // Static catalog images
  '/assets/',          // Static asset images
  `https://${S3_BUCKET}.s3.`,  // S3 permanent storage (dynamic bucket)
];

// Known temporary URL patterns to block
const TEMP_URL_PATTERNS = [
  'oaidalleapiprodscus',  // DALL-E temporary URLs
  'blob.core.windows.net', // Azure blob temporary URLs
  'openai.com',           // Any OpenAI domain
];

export interface ImageValidationResult {
  isFirstParty: boolean;
  needsIngestion: boolean;
  reason: string;
}

export interface ImageIngestionResult {
  success: boolean;
  permanentUrl?: string;
  error?: string;
  status: 'ingested' | 'pending' | 'failed' | 'already_permanent';
}

/**
 * Check if an image URL is a first-party permanent URL
 * First-party means: stored in our Object Storage or static catalog
 */
export function isFirstPartyImageUrl(url: string | undefined | null): ImageValidationResult {
  if (!url) {
    return {
      isFirstParty: false,
      needsIngestion: false,
      reason: 'No image URL provided'
    };
  }

  // Check if it's a first-party URL
  const isFirstParty = FIRST_PARTY_PREFIXES.some(prefix => url.startsWith(prefix));
  
  if (isFirstParty) {
    return {
      isFirstParty: true,
      needsIngestion: false,
      reason: `URL is first-party (${url.substring(0, 30)}...)`
    };
  }

  // Check if it's a known temporary URL that needs ingestion
  const isKnownTemp = TEMP_URL_PATTERNS.some(pattern => url.includes(pattern));
  
  if (isKnownTemp) {
    return {
      isFirstParty: false,
      needsIngestion: true,
      reason: 'URL is a known temporary third-party URL'
    };
  }

  // External http(s) URLs need ingestion
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return {
      isFirstParty: false,
      needsIngestion: true,
      reason: 'URL is external and needs ingestion'
    };
  }

  // Unknown relative paths - assume they're okay (could be legacy)
  return {
    isFirstParty: true,
    needsIngestion: false,
    reason: 'URL appears to be a local relative path'
  };
}

/**
 * Ingest a temporary image URL into permanent storage
 * Downloads the image and uploads to Replit Object Storage
 * 
 * @param tempUrl - The temporary URL to ingest
 * @param mealName - Name to use for the stored file
 * @returns Ingestion result with permanent URL or pending status
 */
export async function ingestImageToPermanentStorage(
  tempUrl: string,
  mealName: string
): Promise<ImageIngestionResult> {
  // First check if it's already permanent
  const validation = isFirstPartyImageUrl(tempUrl);
  if (validation.isFirstParty) {
    return {
      success: true,
      permanentUrl: tempUrl,
      status: 'already_permanent'
    };
  }

  if (!validation.needsIngestion) {
    return {
      success: false,
      error: validation.reason,
      status: 'failed'
    };
  }

  try {
    console.log(`📦 Ingesting image for: ${mealName}`);
    
    // Generate a hash for deduplication
    const hash = crypto.createHash('md5').update(tempUrl).digest('hex');
    
    // Upload to permanent storage
    const result = await uploadImageToPermanentStorage({
      imageUrl: tempUrl,
      mealName,
      imageHash: hash
    });

    console.log(`✅ Image ingested successfully: ${result.permanentUrl}`);
    
    return {
      success: true,
      permanentUrl: result.permanentUrl,
      status: 'ingested'
    };
  } catch (error: any) {
    console.error(`❌ Image ingestion failed for ${mealName}:`, error.message);
    
    return {
      success: false,
      error: error.message,
      status: 'pending' // Mark as pending for retry
    };
  }
}

/**
 * Process a meal's imageUrl before save
 * Implements the save-time gate for Canva-style persistence
 * 
 * @param imageUrl - The current image URL
 * @param mealName - Name of the meal (for storage)
 * @returns Object with finalUrl and imagePending flag
 */
export async function processMealImageForSave(
  imageUrl: string | undefined | null,
  mealName: string
): Promise<{
  imageUrl: string | null;
  imagePending: boolean;
  ingestionAttempted: boolean;
}> {
  // No image provided
  if (!imageUrl) {
    return {
      imageUrl: null,
      imagePending: false,
      ingestionAttempted: false
    };
  }

  const validation = isFirstPartyImageUrl(imageUrl);

  // Already permanent - no action needed
  if (validation.isFirstParty) {
    return {
      imageUrl,
      imagePending: false,
      ingestionAttempted: false
    };
  }

  // Needs ingestion - attempt it
  if (validation.needsIngestion) {
    const ingestionResult = await ingestImageToPermanentStorage(imageUrl, mealName);

    if (ingestionResult.success && ingestionResult.permanentUrl) {
      // Successfully ingested - use permanent URL
      return {
        imageUrl: ingestionResult.permanentUrl,
        imagePending: false,
        ingestionAttempted: true
      };
    } else {
      // Ingestion failed - save with pending flag (Policy 1 - Option B)
      console.warn(`⚠️ Image ingestion failed for ${mealName}, marking as pending`);
      return {
        imageUrl: null, // Don't save temp URL
        imagePending: true,
        ingestionAttempted: true
      };
    }
  }

  // Shouldn't reach here, but handle gracefully
  return {
    imageUrl,
    imagePending: false,
    ingestionAttempted: false
  };
}

/**
 * Validate a batch of meals for image persistence
 * Returns list of meals that have temporary URLs
 */
export function findMealsWithTempImages(meals: Array<{ name?: string; imageUrl?: string }>): Array<{
  name: string;
  imageUrl: string;
  reason: string;
}> {
  const tempMeals: Array<{ name: string; imageUrl: string; reason: string }> = [];

  for (const meal of meals) {
    if (meal.imageUrl) {
      const validation = isFirstPartyImageUrl(meal.imageUrl);
      if (!validation.isFirstParty && validation.needsIngestion) {
        tempMeals.push({
          name: meal.name || 'Unknown',
          imageUrl: meal.imageUrl,
          reason: validation.reason
        });
      }
    }
  }

  return tempMeals;
}
