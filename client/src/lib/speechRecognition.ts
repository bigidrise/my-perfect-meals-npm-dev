import { Capacitor } from "@capacitor/core";
import { SpeechRecognition as CapgoSpeechRecognition } from "@capgo/capacitor-speech-recognition";

type SpeechCallback = (transcript: string, isFinal: boolean) => void;
type ErrorCallback = (error: string) => void;
type EndCallback = () => void;

interface SpeechRecognitionController {
  start: () => Promise<boolean>;
  stop: () => void;
  isListening: () => boolean;
}

let isCurrentlyListening = false;
let partialListener: any = null;

export function createSpeechRecognition(
  onResult: SpeechCallback,
  onError: ErrorCallback,
  onEnd: EndCallback
): SpeechRecognitionController {
  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    return createNativeSpeechRecognition(onResult, onError, onEnd);
  } else {
    return createWebSpeechRecognition(onResult, onError, onEnd);
  }
}

function createNativeSpeechRecognition(
  onResult: SpeechCallback,
  onError: ErrorCallback,
  onEnd: EndCallback
): SpeechRecognitionController {
  let accumulatedTranscript = "";

  const start = async (): Promise<boolean> => {
    try {
      const { available } = await CapgoSpeechRecognition.available();
      if (!available) {
        console.error("[Speech] Native speech recognition not available");
        onError("not-available");
        return false;
      }

      await CapgoSpeechRecognition.requestPermissions();

      if (partialListener) {
        await partialListener.remove();
        partialListener = null;
      }

      accumulatedTranscript = "";
      isCurrentlyListening = true;

      partialListener = await CapgoSpeechRecognition.addListener(
        "partialResults",
        (event: { matches?: string[] }) => {
          if (event.matches && event.matches.length > 0) {
            const transcript = event.matches[0];
            console.log("[Speech Native] Partial result:", transcript);
            onResult(transcript, false);
            accumulatedTranscript = transcript;
          }
        }
      );

      await CapgoSpeechRecognition.start({
        language: "en-US",
        maxResults: 1,
        partialResults: true,
        popup: false,
      });

      console.log("[Speech Native] Started listening");
      return true;
    } catch (error: any) {
      console.error("[Speech Native] Start error:", error);
      isCurrentlyListening = false;
      onError(error?.message || "start-failed");
      return false;
    }
  };

  const stop = async () => {
    try {
      if (isCurrentlyListening) {
        await CapgoSpeechRecognition.stop();
        console.log("[Speech Native] Stopped, final transcript:", accumulatedTranscript);
        
        if (accumulatedTranscript) {
          onResult(accumulatedTranscript, true);
        }
      }

      if (partialListener) {
        await partialListener.remove();
        partialListener = null;
      }

      isCurrentlyListening = false;
      onEnd();
    } catch (error) {
      console.error("[Speech Native] Stop error:", error);
      isCurrentlyListening = false;
      onEnd();
    }
  };

  return {
    start,
    stop,
    isListening: () => isCurrentlyListening,
  };
}

function createWebSpeechRecognition(
  onResult: SpeechCallback,
  onError: ErrorCallback,
  onEnd: EndCallback
): SpeechRecognitionController {
  let recognition: any = null;
  let accumulatedTranscript = "";

  const SpeechRecognitionAPI =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  if (!SpeechRecognitionAPI) {
    console.warn("[Speech Web] SpeechRecognition API not supported");
    return {
      start: async () => {
        onError("unsupported");
        return false;
      },
      stop: () => {},
      isListening: () => false,
    };
  }

  const start = async (): Promise<boolean> => {
    try {
      accumulatedTranscript = "";
      isCurrentlyListening = true;

      recognition = new SpeechRecognitionAPI();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: any) => {
        let finalTranscript = "";
        let interimTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript;
          } else {
            interimTranscript += result[0].transcript;
          }
        }

        if (finalTranscript) {
          accumulatedTranscript += finalTranscript;
          console.log("[Speech Web] Final chunk:", finalTranscript);
          onResult(accumulatedTranscript, false);
        } else if (interimTranscript) {
          console.log("[Speech Web] Interim:", interimTranscript);
        }
      };

      recognition.onerror = (event: any) => {
        console.error("[Speech Web] Error:", event.error);
        if (event.error !== "aborted") {
          onError(event.error);
        }
      };

      recognition.onend = () => {
        console.log("[Speech Web] Recognition ended");
        if (isCurrentlyListening) {
          isCurrentlyListening = false;
          if (accumulatedTranscript) {
            onResult(accumulatedTranscript, true);
          }
          onEnd();
        }
      };

      recognition.start();
      console.log("[Speech Web] Started listening");
      return true;
    } catch (error: any) {
      console.error("[Speech Web] Start error:", error);
      isCurrentlyListening = false;
      onError(error?.message || "start-failed");
      return false;
    }
  };

  const stop = () => {
    try {
      if (recognition) {
        recognition.stop();
        console.log("[Speech Web] Stopped, final transcript:", accumulatedTranscript);
        
        if (accumulatedTranscript && isCurrentlyListening) {
          onResult(accumulatedTranscript, true);
        }
        
        recognition = null;
      }
      isCurrentlyListening = false;
      onEnd();
    } catch (error) {
      console.error("[Speech Web] Stop error:", error);
      isCurrentlyListening = false;
      onEnd();
    }
  };

  return {
    start,
    stop,
    isListening: () => isCurrentlyListening,
  };
}

export async function checkSpeechRecognitionAvailability(): Promise<{
  available: boolean;
  isNative: boolean;
}> {
  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    try {
      const { available } = await CapgoSpeechRecognition.available();
      return { available, isNative: true };
    } catch {
      return { available: false, isNative: true };
    }
  } else {
    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    return { available: !!SpeechRecognitionAPI, isNative: false };
  }
}

export async function requestSpeechPermissions(): Promise<boolean> {
  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    try {
      await CapgoSpeechRecognition.requestPermissions();
      return true;
    } catch (error) {
      console.error("[Speech] Permission request failed:", error);
      return false;
    }
  } else {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      return true;
    } catch (error) {
      console.error("[Speech] Microphone permission denied:", error);
      return false;
    }
  }
}
