import { speechBubbleManager } from '../utils/speechBubbleManager';
import { apiUrl } from '@/lib/resolveApiBase';

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

  // Early return if ElevenLabs is disabled
  if (!AVATAR_FEATURES.ELEVENLABS_ENABLED) {
    console.log('🚫 ElevenLabs disabled by feature flag');
    return;
  }

  const selectedAvatar = localStorage.getItem('selectedAvatar') || '';
  const shouldSpeak = localStorage.getItem('voiceEnabled') !== 'false';

  // Get API key and voice ID from backend since we want to keep them secure
  let apiKey: string | null = null;
  let customVoiceId: string | null = null;
  try {
    const response = await fetch(apiUrl('/api/elevenlabs-config'));
    if (response.ok) {
      const config = await response.json();
      apiKey = config.apiKey;
      customVoiceId = config.voiceId;
    }
  } catch (error) {
    console.log('Failed to get ElevenLabs config:', error);
  }

  // Always show speech bubble if enabled, regardless of voice
  speechBubbleManager.showSpeechBubble(text);

  if (!shouldSpeak) {
    console.log('Voice disabled');
    return;
  }

  // Try ElevenLabs first if API key is available
  if (apiKey) {
    try {
      // Use custom voice ID from server config, fallback to defaults only if not set
      const voiceId = customVoiceId || (selectedAvatar.includes('Female') ? '21m00Tcm4TlvDq8ikWAM' : 'pNInz6obpgDQGcFmaJgB');
      console.log('🎤 Attempting ElevenLabs TTS:', { text, voiceId, mood, usingCustomVoice: !!customVoiceId });

      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey
        },
        body: JSON.stringify({
          text,
          voice_settings: {
            stability: mood === 'professional' ? 0.8 : 0.5,
            similarity_boost: mood === 'casual' ? 0.6 : 0.75
          }
        })
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
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
  }

  // NO FALLBACK - branded voice only, stay silent if unavailable
  console.log('🔇 Voice unavailable, staying silent');
}