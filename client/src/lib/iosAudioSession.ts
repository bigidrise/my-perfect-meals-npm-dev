/**
 * iOS Audio Session Reset Utility
 * 
 * On iOS, after TTS playback, the audio session stays in "output mode"
 * and speech recognition receives no mic input. This utility forces
 * an audio session reset to properly switch to input mode.
 */

const isIOS = (): boolean => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

let audioContext: AudioContext | null = null;

/**
 * Resets the iOS audio session to prepare for mic input.
 * Call this AFTER TTS ends and BEFORE starting speech recognition.
 */
export async function resetAudioSessionForInput(): Promise<void> {
  if (!isIOS()) {
    return;
  }

  console.log("🔊 iOS: Resetting audio session for input...");

  try {
    if (audioContext) {
      await audioContext.close();
      audioContext = null;
    }

    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    source.connect(analyser);
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    stream.getTracks().forEach(track => track.stop());
    
    console.log("🔊 iOS: Audio session reset complete, mic route active");
  } catch (error) {
    console.error("🔊 iOS: Audio session reset failed:", error);
  }
}

/**
 * Prepare audio session before TTS playback
 */
export async function prepareForTTS(): Promise<void> {
  if (!isIOS()) {
    return;
  }

  console.log("🔊 iOS: Preparing audio session for TTS...");
  
  try {
    if (audioContext) {
      await audioContext.close();
      audioContext = null;
    }
  } catch (error) {
    console.error("🔊 iOS: TTS preparation failed:", error);
  }
}

/**
 * Full audio session lifecycle for voice mode:
 * 1. Prepare for TTS
 * 2. Play TTS (external)
 * 3. Reset for input
 * 4. Start recognition (external)
 */
export const iosAudioSession = {
  isIOS,
  prepareForTTS,
  resetForInput: resetAudioSessionForInput,
};
