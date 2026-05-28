import { captureImage } from './photoCaptureBase';
import { apiUrl } from './resolveApiBase';
import { getAuthHeaders } from './auth';

export type ScoreVerdict = 'thumbsUp' | 'thumbsDown' | 'neutral';

export interface ScoreCard {
  verdict: ScoreVerdict;
  reason: string;
}

export interface ScanScoreCards {
  kids: ScoreCard;
  adults: ScoreCard;
  diet: ScoreCard;
  fitnessGoal: ScoreCard;
}

export interface IngredientScanResult {
  alignmentGrade: 'A' | 'B' | 'C' | 'D';
  overallSummary: string;
  verdict: string;
  verdictLevel: 'buy' | 'caution' | 'skip';
  scoreCards: ScanScoreCards;
  ingredientDecoder: Array<{ name: string; plain: string; flag: 'ok' | 'watch' | 'avoid' }>;
  ingredientConsiderations: string[];
  mayNotAlignWith: string[];
  betterFor: string[];
  householdNotes: string[];
  educationalFooter: string;
  extractedIngredients: string[];
  highRiskFindings: Array<{
    ingredientName: string;
    reason: string;
    riskByProtocol: Record<string, string>;
    failClosed: boolean;
  }>;
  ocrConfidenceLow: boolean;
  fallbackUsed: boolean;
}

export interface IngredientCaptureCallbacks {
  onStart?: () => void;
  onAnalyzing?: () => void;
  onSuccess?: (result: IngredientScanResult) => void;
  onError?: (error: string) => void;
  onCancel?: () => void;
}

async function analyzeIngredients(
  base64DataUrl: string,
  callbacks?: IngredientCaptureCallbacks,
  companionId?: string,
): Promise<IngredientScanResult | null> {
  try {
    callbacks?.onAnalyzing?.();
    const response = await fetch(apiUrl('/api/biometrics/ingredient-intelligence'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ image: base64DataUrl, ...(companionId ? { companionId } : {}) }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || err.detail || 'Analysis failed');
    }

    const data = await response.json();
    const result: IngredientScanResult = data.result ?? data;
    callbacks?.onSuccess?.(result);
    return result;
  } catch (err: any) {
    const msg = err?.message || 'Failed to analyze ingredients';
    callbacks?.onError?.(msg);
    return null;
  }
}

export async function launchIngredientPhotoCapture(
  callbacks?: IngredientCaptureCallbacks,
  companionId?: string,
): Promise<IngredientScanResult | null> {
  const captured = await captureImage({
    onStart: callbacks?.onStart,
    onCancel: callbacks?.onCancel,
    onError: callbacks?.onError,
  });

  if (!captured) return null;
  return analyzeIngredients(captured.base64DataUrl, callbacks, companionId);
}
