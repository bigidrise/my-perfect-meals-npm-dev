import { apiUrl } from './resolveApiBase';

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

function createFileInput(): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.capture = 'environment';
  input.style.display = 'none';
  document.body.appendChild(input);
  return input;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export async function launchMacroPhotoCapture(callbacks?: CaptureCallbacks): Promise<MacroResult | null> {
  return new Promise((resolve) => {
    const input = createFileInput();

    input.onchange = async () => {
      const file = input.files?.[0];
      document.body.removeChild(input);

      if (!file) {
        callbacks?.onCancel?.();
        resolve(null);
        return;
      }

      callbacks?.onStart?.();

      try {
        callbacks?.onAnalyzing?.();
        const base64 = await fileToBase64(file);

        const response = await fetch(apiUrl('/api/biometrics/analyze-photo'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64 }),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.detail || error.error || 'Analysis failed');
        }

        const result: MacroResult = await response.json();
        callbacks?.onSuccess?.(result);
        resolve(result);

      } catch (err: any) {
        const errorMsg = err?.message || 'Failed to analyze photo';
        callbacks?.onError?.(errorMsg);
        resolve(null);
      }
    };

    input.oncancel = () => {
      document.body.removeChild(input);
      callbacks?.onCancel?.();
      resolve(null);
    };

    input.click();
  });
}
