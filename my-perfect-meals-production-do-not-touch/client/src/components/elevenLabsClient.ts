import { speechBubbleManager } from '../utils/speechBubbleManager';
import { apiUrl } from '@/lib/resolveApiBase';

// Feature flags
const AVATAR_FEATURES = {
  ELEVENLABS_ENABLED: false, // Flag to disable ElevenLabs
  CHEF_AVATAR_ENABLED: false, // Flag to disable chef avatar system
};

// Fallback to browser speech synthesis if ElevenLabs fails
function speakWithBrowserTTS(text: string, mood: string): void {
  if (!('speechSynthesis' in window)) {
    console.log('Browser TTS not supported');
    return;
  }

  const selectedAvatar = localStorage.getItem('selectedAvatar') || '';
  const utterance = new SpeechSynthesisUtterance(text);

  // Configure voice based on avatar
  const voices = speechSynthesis.getVoices();
  const isFemale = selectedAvatar.includes('Female');

  // Find appropriate voice
  const preferredVoice = voices.find(voice =>
    isFemale ? voice.name.includes('Female') || voice.name.includes('Woman') || voice.name.includes('Samantha')
             : voice.name.includes('Male') || voice.name.includes('Man') || voice.name.includes('Alex')
  );

  if (preferredVoice) {
    utterance.voice = preferredVoice;
  }

  // Configure based on mood
  utterance.rate = mood === 'casual' ? 1.1 : mood === 'professional' ? 0.9 : 1.0;
  utterance.pitch = isFemale ? 1.2 : 0.8;
  utterance.volume = 0.8;

  speechSynthesis.speak(utterance);
  console.log('✅ Browser TTS speaking:', text);
}

export async function speakWithElevenLabs(text: string, mood: string = 'professional'): Promise<void> {
  console.log('🎤 ElevenLabs TTS request:', { text, mood });

  // Early return if ElevenLabs is disabled
  if (!AVATAR_FEATURES.ELEVENLABS_ENABLED) {
    console.log('🚫 ElevenLabs disabled by feature flag');
    return;
  }

  const selectedAvatar = localStorage.getItem('selectedAvatar') || '';
  const shouldSpeak = localStorage.getItem('voiceEnabled') !== 'false';

  // Get API key from backend since Vite env vars need VITE_ prefix and we want to keep the key secure
  let apiKey: string | null = null;
  try {
    const response = await fetch(apiUrl('/api/elevenlabs-config'));
    if (response.ok) {
      const config = await response.json();
      apiKey = config.apiKey;
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
      const voiceId = selectedAvatar.includes('Female') ? '21m00Tcm4TlvDq8ikWAM' : 'pNInz6obpgDQGcFmaJgB';
      console.log('🎤 Attempting ElevenLabs TTS:', { text, voiceId, mood });

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
      console.log('ElevenLabs failed, falling back to browser TTS:', error);
    }
  }

  // Fallback to browser speech synthesis
  speakWithBrowserTTS(text, mood);
}