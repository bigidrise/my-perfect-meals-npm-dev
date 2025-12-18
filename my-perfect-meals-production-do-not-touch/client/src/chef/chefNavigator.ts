// Chef Navigation System
// Uses card names (what users see) for navigation, not internal page names

import { FEATURES, Feature } from './featureRegistry';
import { useLocation } from 'wouter';

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g,'').replace(/\s+/g,' ').trim();
}

// Simple string score (exact > startsWith > includes > fuzzy)
function scoreMatch(query: string, candidate: string): number {
  if (!candidate) return 0;
  const q = norm(query), c = norm(candidate);
  if (q === c) return 100;
  if (c.startsWith(q)) return 85;
  if (c.includes(q)) return 70;
  // tiny fuzzy: proportion of query tokens found in candidate
  const qt = q.split(' ');
  const hit = qt.filter(t => t && c.includes(t)).length;
  return Math.min(60, Math.floor((hit / Math.max(1, qt.length)) * 60));
}

export type NavResolution = {
  feature?: Feature;
  reasons?: string[];
  candidates?: Array<{feature: Feature; score: number}>;
};

export function resolveFeature(query: string): NavResolution {
  const reasons: string[] = [];
  const scored: Array<{feature: Feature; score: number}> = [];

  for (const f of FEATURES) {
    const allNames = [f.displayName, ...(f.synonyms || [])];
    const best = Math.max(...allNames.map(n => scoreMatch(query, n)));
    if (best > 0) scored.push({ feature: f, score: best });
  }

  scored.sort((a,b)=>b.score-a.score);
  const top = scored[0];

  if (!top || top.score < 50) {
    reasons.push('No confident match. Try using the feature\'s card name.');
    return { reasons, candidates: scored.slice(0,5) };
  }
  return { feature: top.feature, candidates: scored.slice(0,5) };
}

// Hook-based navigation for use within React components
export function useChefNavigation() {
  const [, setLocation] = useLocation();
  
  return function navigateByVoice(query: string): { ok: boolean; message?: string; feature?: Feature } {
    const res = resolveFeature(query);
    if (!res.feature) {
      const suggestions = res.candidates?.slice(0,3).map(c => c.feature.displayName).join(', ') || '';
      const message = suggestions 
        ? `I couldn't find that section. Did you mean: ${suggestions}?`
        : 'I couldn\'t find that section. Try saying the card name (e.g., "Kids Meals", "AI Meal Creator").';
      return { ok: false, message };
    }

    setLocation(res.feature.path);
    
    return { 
      ok: true, 
      feature: res.feature,
      message: `Opening ${res.feature.displayName} for you!`
    };
  };
}

// Alternative navigation function for use outside of React components
export function navigateByVoiceImperative(query: string): { ok: boolean; message?: string; feature?: Feature; path?: string } {
  const res = resolveFeature(query);
  if (!res.feature) {
    const suggestions = res.candidates?.slice(0,3).map(c => c.feature.displayName).join(', ') || '';
    const message = suggestions 
      ? `I couldn't find that section. Did you mean: ${suggestions}?`
      : 'I couldn\'t find that section. Try saying the card name (e.g., "Kids Meals", "AI Meal Creator").';
    return { ok: false, message };
  }

  return { 
    ok: true, 
    feature: res.feature,
    path: res.feature.path,
    message: `Opening ${res.feature.displayName} for you!`
  };
}

// Helper to get feature by exact display name
export function getFeatureByDisplayName(displayName: string): Feature | undefined {
  return FEATURES.find(f => f.displayName.toLowerCase() === displayName.toLowerCase());
}

// Helper to get all visible features (for dashboard cards)
export function getVisibleFeatures(): Feature[] {
  return FEATURES.filter(f => !f.hidden);
}

// Helper to search features by partial name
export function searchFeatures(query: string): Feature[] {
  const results = resolveFeature(query);
  return results.candidates?.map(c => c.feature) || [];
}