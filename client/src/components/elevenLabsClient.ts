import { speechBubbleManager } from '../utils/speechBubbleManager';
import { apiUrl } from '@/lib/resolveApiBase';
import { getAuthHeaders } from '@/lib/auth';

/**
 * BRANDED VOICE ONLY - NO FALLBACKS
 * @deprecated Use VoiceManager instead
 */

const AVATAR_FEATURES = {
  ELEVENLABS_ENABLED: false,
  CHEF_AVATAR_ENABLED: false,
};

export async function speakWithElevenLabs(text: string, mood: string = 'professional'): Promise<void> {
  console.log('🎤 ElevenLabs TTS request:', { text, mood });

  if (!AVATAR_FEATURES.ELEVENLABS_ENABLED) {
    console.log('🚫 ElevenLabs disabled by feature flag');
    return;
  }

  const shouldSpeak = localStorage.getItem('voiceEnabled') !== 'false';

  speechBubbleManager.showSpeechBubble(text);

  if (!shouldSpeak) {
    console.log('Voice disabled');
    return;
  }

  try {
    const response = await fetch(apiUrl('/api/tts'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      credentials: 'include',
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      throw new Error(`TTS proxy error: ${response.status} ${response.statusText}`);
    }

    const audioBlob = await response.blob();
    const audioURL = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioURL);

    audio.onended = () => URL.revokeObjectURL(audioURL);
    await audio.play();
    console.log('✅ ElevenLabs voice played successfully');
    return;
  } catch (error) {
    console.log('ElevenLabs failed, staying silent (no fallback):', error);
  }

  console.log('🔇 Voice unavailable, staying silent');
}
