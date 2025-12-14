# Meal Image Storage Setup Guide

## Overview
Your meal images are now configured to persist permanently using Replit's Object Storage instead of temporary DALL-E URLs that expire after 1-2 hours.

## How It Works

### Before (Problem):
1. User creates meal → DALL-E generates image → **temporary URL** stored in database
2. User returns later → **URL expired** → Image doesn't load ❌

### After (Solution):
1. User creates meal → DALL-E generates image → System **downloads image**
2. Image **uploaded to permanent storage** → **Permanent URL** saved to database
3. User can view image anytime, even months later ✅

## Setup Required

### Step 1: Create Object Storage Bucket
1. Open your Replit project
2. Click on **"Tools"** in the left sidebar
3. Select **"Object Storage"**
4. Click **"Create Bucket"**
5. Name your bucket (e.g., `meal-images`)
6. Click **"Create"**

### Step 2: Configure Environment Variables
After creating the bucket, you need to set the environment variable:

1. In Replit, go to **Tools** → **Secrets**
2. Add a new secret:
   - **Key:** `PUBLIC_OBJECT_SEARCH_PATHS`
   - **Value:** `/meal-images` (or whatever you named your bucket, with a leading slash)

**Example:**
```
PUBLIC_OBJECT_SEARCH_PATHS=/meal-images
```

If you have multiple buckets, separate them with commas:
```
PUBLIC_OBJECT_SEARCH_PATHS=/meal-images,/other-bucket
```

### Step 3: Verify Setup
After setting the environment variable:

1. Restart your application (it will restart automatically)
2. Generate a new meal with an image
3. Check the console logs for:
   - `🎨 Generating image for: [meal name]`
   - `📦 Uploading to permanent storage...`
   - `✅ Generated and stored permanent image for [meal name]`

## What's Changed

### Files Modified:
- ✅ `server/services/mealImageGenerator.ts` - Now uploads to permanent storage
- ✅ `server/services/permanentImageStorage.ts` - New service for image uploads
- ✅ `server/objectStorage.ts` - Replit Object Storage integration
- ✅ `server/objectAcl.ts` - Access control for stored files
- ✅ `server/index.ts` - Added route to serve public images

### New Image Flow:
1. DALL-E generates image (temporary URL)
2. System downloads the image data
3. Image uploaded to Replit Object Storage
4. Permanent URL saved to database: `/public-objects/meal-images/[filename].png`
5. Images cached in-memory for fast repeated access

## Troubleshooting

### Error: "PUBLIC_OBJECT_SEARCH_PATHS not configured"
- Make sure you've set the environment variable in Secrets
- Restart the application after setting it

### Images still not showing
1. Check the console logs for upload errors
2. Verify the bucket exists in Object Storage tool
3. Make sure the bucket path matches the environment variable

### Old meals with expired images
- Old meals with temporary DALL-E URLs will still be broken
- They will need to be regenerated to get permanent URLs
- Consider adding a migration script if you have many existing meals

## Benefits

✅ **Permanent Storage** - Images never expire  
✅ **Faster Loading** - Images served from CDN  
✅ **Reliability** - No dependency on external temporary URLs  
✅ **Caching** - Smart caching prevents duplicate uploads  
✅ **Cost Effective** - Saves OpenAI API credits by not regenerating images

## Notes

- Images are stored with unique hashes to prevent duplicates
- The same meal ingredients will reuse the same image
- Images are publicly accessible via `/public-objects/` URLs
- Storage is provided by Google Cloud Storage (via Replit)
