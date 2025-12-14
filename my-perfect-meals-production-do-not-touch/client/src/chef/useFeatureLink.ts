// Optional helper to keep card titles and Chef in sync at render time
import { FEATURES } from './featureRegistry';

export function useFeatureLink(displayName: string): string | undefined {
  const feature = FEATURES.find(f => 
    f.displayName.toLowerCase() === displayName.toLowerCase()
  );
  return feature?.path;
}

// Helper to get feature info by display name
export function useFeatureInfo(displayName: string) {
  const feature = FEATURES.find(f => 
    f.displayName.toLowerCase() === displayName.toLowerCase()
  );
  return feature || null;
}