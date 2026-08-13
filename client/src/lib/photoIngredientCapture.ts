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

export type OutcomeVerdict = 'supports' | 'caution' | 'conflicts' | 'neutral';

export interface ProtocolOutcomeCard {
  protocolKey: string;
  label: string;
  verdict: OutcomeVerdict;
  reason: string;
}

export interface BetterAlternative {
  category: string;
  whyBetter: string[];
  targetCriteria: string;
}

export interface IngredientScanResult {
  alignmentGrade: 'A' | 'B' | 'C' | 'D';
  overallSummary: string;
  verdict: string;
  verdictLevel: 'buy' | 'caution' | 'skip';
  scoreCards: ScanScoreCards;
  outcomeCards: ProtocolOutcomeCard[];
  analysisProfile: string[];
  betterAlternatives: BetterAlternative[];
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
  productName: string;
  isFrontLabel: boolean;
  productNameMissing: boolean;
  analysisMethod: 'by_name' | 'by_label' | 'full_product_advisor';
  profileFactorsUsed: string[];
  whatMattersMost: string[];
  /** UPC/barcode if the scan originated from a barcode scanner */
  barcode?: string;
  /**
   * Barcode lookup metadata — only present when the scan was initiated via a
   * barcode/UPC lookup rather than a camera label scan.
   * true  → product was matched in Open Food Facts (or equivalent DB)
   * false → nutrition was estimated from the raw barcode; less reliable
   */
  resolvedFromDb?: boolean;
  /** The canonical product name returned by the barcode database, if any */
  resolvedName?: string;
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
