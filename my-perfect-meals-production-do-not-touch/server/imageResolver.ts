// Image Resolver Service - Hybrid Meal Engine
// Connects imageKey from catalog to Object Storage URLs

import { 
  IMAGE_ASSET_MANIFEST, 
  getImageAsset, 
  type ImageAssetEntry 
} from "../shared/catalog/imageAssetManifest.catalog";

const FALLBACK_IMAGE = "generic-meal.jpg";
const MEAL_IMAGES_SUBFOLDER = "meal-images";
const PUBLIC_OBJECTS_PREFIX = "/public-objects";

type ConfigValidation = 
  | { ok: true; basePath: string }
  | { ok: false; reason: string };

function deriveMealImagesBasePath(rawEnv: string | undefined): ConfigValidation {
  if (!rawEnv || rawEnv.trim() === "") {
    return { ok: false, reason: "PUBLIC_OBJECT_SEARCH_PATHS not configured" };
  }

  const entries = rawEnv.split(",").map((e) => e.trim()).filter((e) => e.length > 0);
  if (entries.length === 0) {
    return { ok: false, reason: "PUBLIC_OBJECT_SEARCH_PATHS is empty" };
  }

  let segment = entries[0];

  if (segment.startsWith("http://") || segment.startsWith("https://")) {
    return { ok: false, reason: "Absolute URLs not supported in PUBLIC_OBJECT_SEARCH_PATHS" };
  }

  segment = segment.replace(/^\/+/, "").replace(/\/+$/, "");
  segment = segment.replace(/\/+/g, "/");

  if (segment.startsWith("public-objects/")) {
    segment = segment.slice("public-objects/".length);
  } else if (segment === "public-objects") {
    segment = "";
  }

  segment = segment.replace(/^\/+/, "").replace(/\/+$/, "");

  if (segment === "") {
    return {
      ok: true,
      basePath: `${PUBLIC_OBJECTS_PREFIX}/${MEAL_IMAGES_SUBFOLDER}`,
    };
  }

  const segments = segment.split("/").filter((s) => s.length > 0);
  if (segments.length === 0) {
    return {
      ok: true,
      basePath: `${PUBLIC_OBJECTS_PREFIX}/${MEAL_IMAGES_SUBFOLDER}`,
    };
  }

  const lastSegment = segments[segments.length - 1];
  if (lastSegment === MEAL_IMAGES_SUBFOLDER) {
    return {
      ok: true,
      basePath: `${PUBLIC_OBJECTS_PREFIX}/${segments.join("/")}`,
    };
  }

  return {
    ok: true,
    basePath: `${PUBLIC_OBJECTS_PREFIX}/${segments.join("/")}/${MEAL_IMAGES_SUBFOLDER}`,
  };
}

export class ImageResolver {
  private cachedValidation: ConfigValidation | null = null;

  validateConfiguration(): ConfigValidation {
    if (this.cachedValidation === null) {
      this.cachedValidation = deriveMealImagesBasePath(process.env.PUBLIC_OBJECT_SEARCH_PATHS);
    }
    return this.cachedValidation;
  }

  clearCache(): void {
    this.cachedValidation = null;
  }

  private getBaseUrl(): string {
    const validation = this.validateConfiguration();
    if (validation.ok) {
      return validation.basePath;
    }
    return `${PUBLIC_OBJECTS_PREFIX}/${MEAL_IMAGES_SUBFOLDER}`;
  }

  resolveImageKey(imageKey: string): string {
    const baseUrl = this.getBaseUrl();
    const asset = getImageAsset(imageKey);
    
    if (asset) {
      return `${baseUrl}/${asset.fileName}`;
    }

    if (imageKey.includes("_")) {
      const fallbackAsset = this.findFallbackByCategory(imageKey);
      if (fallbackAsset) {
        return `${baseUrl}/${fallbackAsset.fileName}`;
      }
    }

    return `${baseUrl}/${FALLBACK_IMAGE}`;
  }

  private findFallbackByCategory(imageKey: string): ImageAssetEntry | undefined {
    const categoryPrefix = imageKey.split("_")[0];
    
    const categoryMap: Record<string, ImageAssetEntry["category"]> = {
      "protein": "protein",
      "carb": "carb",
      "veg": "vegetable",
      "fruit": "fruit",
      "fat": "fat",
      "dairy": "dairy",
    };

    const category = categoryMap[categoryPrefix];
    if (!category) return undefined;

    return IMAGE_ASSET_MANIFEST.find(entry => entry.category === category);
  }

  resolveMultiple(imageKeys: string[]): Record<string, string> {
    const result: Record<string, string> = {};
    for (const key of imageKeys) {
      result[key] = this.resolveImageKey(key);
    }
    return result;
  }

  getAssetInfo(imageKey: string): ImageAssetEntry | undefined {
    return getImageAsset(imageKey);
  }

  getAllAssets(): ImageAssetEntry[] {
    return [...IMAGE_ASSET_MANIFEST];
  }

  getMissingImageKeys(requestedKeys: string[]): string[] {
    return requestedKeys.filter(key => !getImageAsset(key));
  }

  isConfigured(): boolean {
    const validation = this.validateConfiguration();
    return validation.ok;
  }

  getStatus(): { configured: boolean; assetCount: number; baseUrl: string; error?: string } {
    const validation = this.validateConfiguration();
    return {
      configured: validation.ok,
      assetCount: IMAGE_ASSET_MANIFEST.length,
      baseUrl: this.getBaseUrl(),
      error: validation.ok ? undefined : validation.reason,
    };
  }
}

export const imageResolver = new ImageResolver();

export function resolveImageKey(imageKey: string): string {
  return imageResolver.resolveImageKey(imageKey);
}

export function resolveImageKeys(imageKeys: string[]): Record<string, string> {
  return imageResolver.resolveMultiple(imageKeys);
}
