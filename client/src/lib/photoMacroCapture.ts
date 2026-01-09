import { apiUrl } from './resolveApiBase';
import { isIosNativeShell } from './platform';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

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

async function analyzePhoto(base64Image: string, callbacks?: CaptureCallbacks): Promise<MacroResult | null> {
  try {
    callbacks?.onAnalyzing?.();

    const response = await fetch(apiUrl('/api/biometrics/analyze-photo'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

async function captureWithCapacitorCamera(callbacks?: CaptureCallbacks): Promise<MacroResult | null> {
  try {
    callbacks?.onStart?.();
    
    const photo = await Camera.getPhoto({
      quality: 80,
      allowEditing: false,
      resultType: CameraResultType.Base64,
      source: CameraSource.Camera,
      correctOrientation: true,
    });

    if (!photo.base64String) {
      callbacks?.onCancel?.();
      return null;
    }

    const base64Image = `data:image/${photo.format || 'jpeg'};base64,${photo.base64String}`;
    return await analyzePhoto(base64Image, callbacks);

  } catch (err: any) {
    if (err?.message?.includes('cancelled') || err?.message?.includes('User cancelled')) {
      callbacks?.onCancel?.();
      return null;
    }
    const errorMsg = err?.message || 'Camera access failed';
    callbacks?.onError?.(errorMsg);
    return null;
  }
}

async function captureWithFileInput(callbacks?: CaptureCallbacks): Promise<MacroResult | null> {
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
        const base64 = await fileToBase64(file);
        const result = await analyzePhoto(base64, callbacks);
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

export async function launchMacroPhotoCapture(callbacks?: CaptureCallbacks): Promise<MacroResult | null> {
  if (isIosNativeShell()) {
    return captureWithCapacitorCamera(callbacks);
  }
  return captureWithFileInput(callbacks);
}
