import { isIosNativeShell } from './platform';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

export interface CaptureResult {
  base64DataUrl: string;
}

export interface CaptureBaseCallbacks {
  onStart?: () => void;
  onCancel?: () => void;
  onError?: (error: string) => void;
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

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

async function captureWithCapacitor(callbacks?: CaptureBaseCallbacks): Promise<CaptureResult | null> {
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
    return { base64DataUrl: `data:image/${photo.format || 'jpeg'};base64,${photo.base64String}` };
  } catch (err: any) {
    if (err?.message?.includes('cancelled') || err?.message?.includes('User cancelled')) {
      callbacks?.onCancel?.();
      return null;
    }
    callbacks?.onError?.(err?.message || 'Camera access failed');
    return null;
  }
}

async function captureWithFileInput(callbacks?: CaptureBaseCallbacks): Promise<CaptureResult | null> {
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
        const base64DataUrl = await fileToBase64(file);
        resolve({ base64DataUrl });
      } catch (err: any) {
        callbacks?.onError?.(err?.message || 'Failed to read file');
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

export async function captureImage(callbacks?: CaptureBaseCallbacks): Promise<CaptureResult | null> {
  if (isIosNativeShell()) {
    return captureWithCapacitor(callbacks);
  }
  return captureWithFileInput(callbacks);
}
