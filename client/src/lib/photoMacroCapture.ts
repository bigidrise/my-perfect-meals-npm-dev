import { apiUrl } from './resolveApiBase';
import { captureImage } from './photoCaptureBase';

export interface MacroResult {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  description?: string;
}

export interface CaptureCallbacks {
  onStart?: () => void;
  onAnalyzing?: () => void;
  onSuccess?: (result: MacroResult) => void;
  onError?: (error: string) => void;
  onCancel?: () => void;
}

async function analyzePhoto(base64Image: string, callbacks?: CaptureCallbacks): Promise<MacroResult | null> {
  try {
    callbacks?.onAnalyzing?.();

    const { getAuthHeaders } = await import('@/lib/auth');
    const response = await fetch(apiUrl('/api/biometrics/analyze-photo'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ image: base64Image }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || error.error || 'Analysis failed');
    }

    const result: MacroResult = await response.json();
    callbacks?.onSuccess?.(result);
    return result;

  } catch (err: any) {
    const errorMsg = err?.message || 'Failed to analyze photo';
    callbacks?.onError?.(errorMsg);
    return null;
  }
}

export async function launchMacroPhotoCapture(callbacks?: CaptureCallbacks): Promise<MacroResult | null> {
  const captured = await captureImage({
    onStart: callbacks?.onStart,
    onCancel: callbacks?.onCancel,
    onError: callbacks?.onError,
  });
  if (!captured) return null;
  return analyzePhoto(captured.base64DataUrl, callbacks);
}
