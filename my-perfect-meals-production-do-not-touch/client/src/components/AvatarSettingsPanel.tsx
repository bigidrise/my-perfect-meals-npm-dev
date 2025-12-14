import React, { useState, useEffect } from 'react';
import { apiUrl } from '@/lib/resolveApiBase';
import { avatarList, moods, type Avatar } from './avatarConfig';
import { speakWithElevenLabs } from './elevenLabsClient';

interface AvatarSettingsPanelProps {
  selectedAvatar: string;
  setSelectedAvatar: (avatar: string) => void;
  onClose: () => void;
  onHideAvatar?: () => void;
  onResetAvatarTimer?: () => void;
}

export const AvatarSettingsPanel = ({ selectedAvatar, setSelectedAvatar, onClose, onHideAvatar, onResetAvatarTimer }: AvatarSettingsPanelProps) => {
  const [voiceEnabled, setVoiceEnabled] = useState(() => {
    return localStorage.getItem('voiceEnabled') !== 'false';
  });
  const [mood, setMood] = useState(() => {
    return localStorage.getItem('avatarMood') || 'professional';
  });
  const [speechTextEnabled, setSpeechTextEnabled] = useState(() => {
    return localStorage.getItem('speechTextEnabled') !== 'false';
  });
  const [textInput, setTextInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [textInputVisible, setTextInputVisible] = useState(true);
  const [textInputTimer, setTextInputTimer] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    localStorage.setItem('selectedAvatar', selectedAvatar);
    localStorage.setItem('voiceEnabled', voiceEnabled.toString());
    localStorage.setItem('avatarMood', mood);
    localStorage.setItem('speechTextEnabled', speechTextEnabled.toString());
  }, [selectedAvatar, voiceEnabled, mood, speechTextEnabled]);

  // Reset text input timer when settings open
  useEffect(() => {
    resetTextInputTimer();
    return () => {
      if (textInputTimer) {
        clearTimeout(textInputTimer);
      }
    };
  }, []);

  // Text input timer functions
  const resetTextInputTimer = () => {
    if (textInputTimer) {
      clearTimeout(textInputTimer);
    }
    
    const newTimer = setTimeout(() => {
      setTextInputVisible(false);
    }, 15000); // 15 seconds for text input
    
    setTextInputTimer(newTimer);
  };

  // Reset text input timer on user interaction
  const handleTextInputActivity = () => {
    resetTextInputTimer();
    if (onResetAvatarTimer) {
      onResetAvatarTimer(); // Also reset avatar timer
    }
  };

  // Test voice function
  const testVoice = () => {
    if (!voiceEnabled) {
      alert('Please enable voice first!');
      return;
    }
    
    const messages = [
      "Hello! This is how I sound with the current settings.",
      "I'm your personal chef assistant, ready to help you!",
      "How does this voice sound to you?",
      "Let's cook something amazing together!"
    ];
    
    const randomMessage = messages[Math.floor(Math.random() * messages.length)];
    speakWithElevenLabs(randomMessage, mood);
  };

  // Voice preview when avatar or mood changes
  const previewVoice = (previewMood: string = mood) => {
    if (!voiceEnabled) return;
    
    const previewText = selectedAvatar.includes('Female') 
      ? "Hi, I'm your female chef assistant!" 
      : "Hello, I'm your male chef assistant!";
    
    // Small delay to let avatar selection save
    setTimeout(() => {
      speakWithElevenLabs(previewText, previewMood);
    }, 100);
  };

  // Handle sending text messages to the chef
  const handleSendMessage = async () => {
    if (!textInput.trim() || isProcessing) return;
    
    setIsProcessing(true);
    const userMessage = textInput.trim();
    setTextInput(''); // Clear input immediately
    
    try {
      // Call the avatar assistant API
      const response = await fetch(apiUrl('/api/avatar-assistant/ask'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          context: { currentPage: window.location.pathname }
        })
      });

      const data = await response.json();
      
      // Handle navigation if provided
      if (data.navigateTo) {
        console.log('🧭 Avatar navigation triggered:', data.navigateTo);
        // Use wouter's setLocation to navigate
        window.history.pushState({}, '', data.navigateTo);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
      
      const chefResponse = data.text || data.captions || data.response || "I'm here to help! What would you like to know about the app?";
      
      // Speak the response if voice is enabled
      if (voiceEnabled) {
        speakWithElevenLabs(chefResponse, mood);
      } else {
        // Show response in alert if voice is disabled
        alert(`Chef says: ${chefResponse}`);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const fallbackResponse = "I'm having trouble connecting right now, but I'm still here to help guide you through the app!";
      if (voiceEnabled) {
        speakWithElevenLabs(fallbackResponse, mood);
      } else {
        alert(`Chef says: ${fallbackResponse}`);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="settings-panel">
      <h3>Avatar Settings</h3>

      <label>Choose Avatar:</label>
      <select
        value={selectedAvatar}
        onChange={(e) => {
          setSelectedAvatar(e.target.value);
          previewVoice(); // Preview voice when avatar changes
        }}>
        {Object.entries(avatarList).map(([key, avatar]: [string, Avatar]) => (
          <option key={key} value={key}>{avatar.name}</option>
        ))}
      </select>

      <label>Voice Mood:</label>
      <select value={mood} onChange={(e) => {
        setMood(e.target.value);
        previewVoice(e.target.value); // Preview voice when mood changes
      }}>
        {moods.map((m: string) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>

      <label>
        <input
          type="checkbox"
          checked={voiceEnabled}
          onChange={() => setVoiceEnabled(!voiceEnabled)}
        /> Enable Voice
      </label>

      <label>
        <input
          type="checkbox"
          checked={speechTextEnabled}
          onChange={() => setSpeechTextEnabled(!speechTextEnabled)}
        /> Show Speech Text (Accessibility)
      </label>

      {/* Text Chat Section - Conditional visibility with 15-second timer */}
      {textInputVisible && (
        <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '6px', border: '1px solid #ddd' }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 'bold' }}>💬 Chat with Your Chef</h4>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <input
              type="text"
              value={textInput}
              onChange={(e) => {
                setTextInput(e.target.value);
                handleTextInputActivity(); // Reset timers on typing
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSendMessage();
                  handleTextInputActivity(); // Reset timers on send
                }
              }}
              onFocus={handleTextInputActivity} // Reset timers on focus
              placeholder="Type your question... (e.g., How do I log a meal?)"
              style={{
                flex: 1,
                padding: '8px 12px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '14px'
              }}
              disabled={isProcessing}
            />
            <button 
              onClick={() => {
                handleSendMessage();
                handleTextInputActivity(); // Reset timers on button click
              }}
              disabled={isProcessing || !textInput.trim()}
              style={{
                background: isProcessing ? '#ccc' : '#ff8c00',
                color: 'white',
                border: 'none',
                padding: '8px 12px',
                borderRadius: '4px',
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                minWidth: '50px',
                maxWidth: '50px',
                width: '50px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                flexShrink: 0
              }}>
              {isProcessing ? '...' : '✈️'}
            </button>
          </div>
          <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: '#666' }}>
            {voiceEnabled ? '🔊 Chef will speak the response' : '💬 Response will appear in a popup'}
          </p>
        </div>
      )}

      <div style={{ marginTop: '10px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button 
          onClick={testVoice}
          style={{
            background: '#ff8c00',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer'
          }}>
          Test Voice
        </button>
        {onHideAvatar && (
          <button 
            onClick={() => {
              onHideAvatar();
              onClose();
            }}
            style={{
              background: '#dc2626',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer'
            }}>
            Hide Avatar
          </button>
        )}
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
};