// ✅ FINAL FIXED VERSION - AvatarSelector.tsx
import React, { useState, useEffect, useRef } from 'react';
import { apiUrl } from '@/lib/resolveApiBase';
import { ChefHat, Mic, MicOff } from 'lucide-react';
import { useLocation } from 'wouter';
import { AvatarSettingsPanel } from './AvatarSettingsPanel';
import { avatarList } from './avatarConfig';
import { speakWithElevenLabs } from './elevenLabsClient';
import { AVATAR_FEATURES } from '../config/avatarFlags';
import TapToRecordButton from './TapToRecordButton';
import AvatarSpeechBubble from './AvatarSpeechBubble';
import { speechBubbleManager } from '../utils/speechBubbleManager';
import './avatarStyles.css';

export const AvatarSelector = () => {
  // Early return if avatar system is disabled
  if (!AVATAR_FEATURES.AVATAR_ENABLED) {
    return null;
  }
  
  const [, setLocation] = useLocation();
  const [selectedAvatar, setSelectedAvatar] = useState(() => {
    return localStorage.getItem('selectedAvatar') || 'blackMale';
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [chefVisible, setChefVisible] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentSpeechText, setCurrentSpeechText] = useState<string>('');
  const [speechBubbleVisible, setSpeechBubbleVisible] = useState<boolean>(false);
  const inactivityTimer = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const speechTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const currentAvatar = avatarList[selectedAvatar];
  
  // Check if speech text is enabled
  const speechTextEnabled = localStorage.getItem('speechTextEnabled') !== 'false';

  // Register speech bubble callback
  useEffect(() => {
    const handleSpeechBubble = (text: string) => {
      showSpeechBubble(text);
    };

    speechBubbleManager.registerCallback(handleSpeechBubble);
    
    return () => {
      speechBubbleManager.unregisterCallback(handleSpeechBubble);
    };
  }, []);

  // Handle any interaction with chef
  const handleChefInteraction = () => {
    resetInactivityTimer();
  };

  // Import voice processing functions from TapToRecordButton
  const processHardcodedCommands = (transcript: string): string | null => {
    const normalizedTranscript = transcript.toLowerCase().trim();
    
    // Enhanced pattern matching with multiple variations
    const routes = [
      { patterns: ['dashboard', 'home', 'main'], route: '/dashboard' },
      { patterns: ['meal planning', 'plan meals', 'meal plan'], route: '/meal-planning' },
      { patterns: ['profile', 'my profile', 'settings'], route: '/profile' },
      { patterns: ['log meals', 'meal log', 'food log'], route: '/food' },
      { patterns: ['meal journal', 'journal', 'food journal'], route: '/meal-journal' },
      { patterns: ['craving creator', 'cravings', 'create craving'], route: '/craving-creator' },
      { patterns: ['restaurant guide', 'restaurants', 'dining'], route: '/restaurant-guide' },
      { patterns: ['kids meals', 'children meals', 'kid food'], route: '/lifestyle' },
      { patterns: ['alcohol hub', 'drinks', 'beverages'], route: '/lifestyle' }
    ];

    for (const { patterns, route } of routes) {
      if (patterns.some(pattern => normalizedTranscript.includes(pattern))) {
        return route;
      }
    }
    return null;
  };

  const getHardcodedResponse = (transcript: string, route: string): string => {
    const routeResponses: Record<string, string> = {
      '/dashboard': "Taking you to your dashboard where you can see your meal overview.",
      '/meal-planning': "Let's plan some delicious and healthy meals for you!",
      '/profile': "Opening your profile settings.",
      '/food': "Time to log what you've been eating today!",
      '/meal-journal': "Let's check out your meal history and journal.",
      '/craving-creator': "I'll help you create something amazing for your cravings!",
      '/restaurant-guide': "Let's find you some great restaurant options!",
      '/lifestyle': "Opening the Lifestyle Hub for you."
    };
    return routeResponses[route] || "I'm taking you there now!";
  };

  const speakResponse = async (text: string): Promise<void> => {
    // Show speech bubble if enabled
    if (speechTextEnabled) {
      showSpeechBubble(text);
    }
    
    return new Promise((resolve) => {
      if (window.speechSynthesis) {
        // Cancel any ongoing speech
        window.speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        utterance.volume = 0.8;
        
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        
        window.speechSynthesis.speak(utterance);
        
        // Fallback timeout
        setTimeout(() => resolve(), 5000);
      } else {
        resolve();
      }
    });
  };

  // Speech bubble management
  const showSpeechBubble = (text: string) => {
    setCurrentSpeechText(text);
    setSpeechBubbleVisible(true);
    
    // Clear any existing timeout
    if (speechTimeoutRef.current) {
      clearTimeout(speechTimeoutRef.current);
    }
    
    // Auto-hide after 8 seconds
    speechTimeoutRef.current = setTimeout(() => {
      setSpeechBubbleVisible(false);
    }, 8000);
  };

  const hideSpeechBubble = () => {
    setSpeechBubbleVisible(false);
    if (speechTimeoutRef.current) {
      clearTimeout(speechTimeoutRef.current);
    }
  };

  // Voice recording functions
  const startRecording = async () => {
    setError(null);
    console.log("🎤 User gesture detected - requesting microphone access...");
    handleChefInteraction();

    if (!navigator.mediaDevices || !window.MediaRecorder) {
      setError("Your browser does not support audio recording. Please try Chrome or Safari.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      console.log("✅ Microphone access granted");
      console.log('🔍 Stream tracks:', stream.getTracks());

      // Create MediaRecorder with better format detection
      let recorder;
      let mimeType = '';
      
      // Try different formats in order of preference
      const formats = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/wav'
      ];
      
      for (const format of formats) {
        if (MediaRecorder.isTypeSupported(format)) {
          try {
            recorder = new MediaRecorder(stream, { mimeType: format });
            mimeType = format;
            console.log('✅ Using audio format:', format);
            break;
          } catch (e) {
            console.log('⚠️ Failed to create recorder with', format);
          }
        }
      }
      
      // Fallback to default if nothing worked
      if (!recorder) {
        console.log('⚠️ Using default MediaRecorder format');
        recorder = new MediaRecorder(stream);
        mimeType = 'audio/webm'; // Default assumption
      }
      
      mediaRecorderRef.current = recorder;
      console.log("📱 MediaRecorder created with mimeType:", recorder.mimeType);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.current.push(event.data);
          console.log("📊 Audio chunk received:", event.data.size, "bytes");
        }
      };

      recorder.onerror = (e) => {
        console.error("💥 MediaRecorder error:", e);
        setError("Recording failed. Please try again.");
        setIsRecording(false);
      };

      recorder.onstop = () => {
        const finalMimeType = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(audioChunks.current, { type: finalMimeType });
        setAudioBlob(blob);
        audioChunks.current = [];
        console.log("🎤 Recording complete, blob created:", blob.size, "bytes", "type:", finalMimeType);
        
        // Stop all stream tracks
        stream.getTracks().forEach(track => {
          track.stop();
          console.log("🔇 Audio track stopped");
        });
        
        // Only auto-send if we have a valid audio size
        if (blob.size > 1000) {
          setTimeout(() => {
            console.log("📤 Auto-sending audio blob...");
            sendAudioBlob(blob);
          }, 100);
        } else {
          console.warn("⚠️ Audio blob too small, likely empty recording:", blob.size);
          setAudioBlob(null);
          setIsRecording(false);
          setError("Recording was too short or silent. Please try again.");
        }
      };

      console.log("🎤 MediaRecorder state before start:", recorder.state);
      if (recorder.state === "inactive") {
        recorder.start(1000); // Record in 1-second chunks
        setIsRecording(true);
        console.log("🔴 Recording started successfully");
        
        // Auto-stop after 10 seconds to prevent infinite recording
        setTimeout(() => {
          if (recorder.state === 'recording') {
            console.log("⏰ Auto-stopping recording after 10 seconds");
            recorder.stop();
            setIsRecording(false);
          }
        }, 10000);
      } else {
        setError("Recorder is already active or unavailable.");
      }
    } catch (err: any) {
      console.error("🚫 Error accessing microphone:", err);
      if (err.name === 'NotAllowedError') {
        setError("Microphone access denied. Please allow microphone permissions.");
      } else if (err.name === 'NotFoundError') {
        setError("No microphone found. Please connect a microphone.");
      } else {
        setError("Failed to access microphone: " + err.message);
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      console.log("⏹️ Stop recording requested, current state:", mediaRecorderRef.current.state);
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      console.log("✅ Recording stopped");
      handleChefInteraction();
    }
  };

  const sendAudioBlob = async (blob: Blob) => {
    setIsProcessing(true);
    handleChefInteraction();
    try {
      console.log('📤 Sending audio to backend...', blob.size, 'bytes');
      const formData = new FormData();
      formData.append('audio', blob, 'voice-recording');

      const response = await fetch(apiUrl('/api/voice/transcribe'), {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Voice transcribed:', data.transcript);
        
        // Check if we got a valid transcript
        if (!data.transcript || data.transcript.trim().length === 0) {
          console.warn('⚠️ Empty transcript received');
          setError("I couldn't hear anything. Please speak louder and try again.");
          setAudioBlob(null);
          return;
        }
        
        // Try hardcoded fallback first for instant response
        const hardcodedRoute = processHardcodedCommands(data.transcript);
        if (hardcodedRoute) {
          console.log('🚀 Using hardcoded route:', hardcodedRoute);
          
          // Show chef when responding
          setChefVisible(true);
          handleChefInteraction();
          
          // Generate appropriate response for the hardcoded route
          const responseText = getHardcodedResponse(data.transcript, hardcodedRoute);
          console.log('🎤 Chef speaking hardcoded response:', responseText);
          await speakResponse(responseText);
          
          // Navigate after a brief delay to let speech start
          setTimeout(() => {
            setLocation(hardcodedRoute);
          }, 2000); // Longer delay for speech to complete
          setAudioBlob(null);
          return;
        }
        
        // Process the voice command with backend
        const commandResponse = await fetch(apiUrl('/api/voice/parse'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript: data.transcript }),
        });

        if (commandResponse.ok) {
          const commandData = await commandResponse.json();
          console.log('🎯 Voice command processed:', commandData);
          
          // Show chef when responding
          setChefVisible(true);
          handleChefInteraction();
          
          // Always make the Chef speak the response
          if (commandData.speech) {
            console.log('🎤 Chef speaking:', commandData.speech);
            await speakResponse(commandData.speech);
          }
          
          if (commandData.action && commandData.action !== 'error') {
            if (commandData.action === 'navigate' && commandData.data) {
              console.log('🚀 Navigating to:', commandData.data);
              // Small delay to let speech start before navigation
              setTimeout(() => {
                setLocation(commandData.data);
              }, 2000);
            } else if (commandData.data?.route) {
              console.log('🚀 Navigating to route:', commandData.data.route);
              setTimeout(() => {
                setLocation(commandData.data.route);
              }, 2000);
            }
          }
        }
        
        // Clear the recording
        setAudioBlob(null);
      } else {
        const errorText = await response.text();
        console.error('❌ Backend error:', response.status, errorText);
        setError('Failed to process voice recording: ' + response.status);
      }
    } catch (error) {
      setError('Failed to send voice recording');
      console.error('Send error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Reset inactivity timer
  const resetInactivityTimer = () => {
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }
    
    inactivityTimer.current = setTimeout(() => {
      setChefVisible(false);
      console.log('🍳 Chef hidden due to inactivity');
    }, 30000); // 30 seconds of inactivity
  };

  // Show chef and reset timer
  const showChef = () => {
    setChefVisible(true);
    resetInactivityTimer();
    console.log('🍳 Chef shown, timer reset');
  };

  // Auto-greet with voice when component mounts
  useEffect(() => {
    const voiceEnabled = localStorage.getItem('voiceEnabled') !== 'false';
    const avatarConfig = localStorage.getItem('avatarConfig');
    let config = { voiceEnabled: false };
    
    // Single voice greeting on mount
    const greetingMessage = "Welcome back! I'm your chef. What would you like to do today?";
    const mood = localStorage.getItem('avatarMood') || 'professional';
    
    // Only greet if voice is enabled and ElevenLabs is enabled
    if (voiceEnabled && AVATAR_FEATURES.ELEVENLABS_ENABLED) {
      setTimeout(() => {
        console.log('🎤 Chef voice greeting triggered');
        speakWithElevenLabs(greetingMessage, mood);
      }, 1500);
    }
    
    try {
      if (avatarConfig) {
        config = JSON.parse(avatarConfig);
      }
    } catch (e) {
      console.log('Using default avatar config');
    }

    // Voice greeting handled above - no duplicate needed

    // Start inactivity timer
    resetInactivityTimer();

    // Cleanup timer on unmount
    return () => {
      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
      }
    };
  }, []);

  // Debug logging
  console.log('🎯 AvatarSelector rendering:', {
    selectedAvatar,
    currentAvatar,
    imageUrl: currentAvatar?.image,
    settingsOpen
  });

  return (
    <div className="avatar-container avatar-top-right">
      {chefVisible ? (
        <div className="avatar-wrapper">
          <button 
            className="avatar-button"
            onClick={() => {
              setSettingsOpen(!settingsOpen);
              handleChefInteraction();
            }}>
            <img
              src={currentAvatar.image}
              alt={currentAvatar.name}
              className="avatar-bust"
              onLoad={() => console.log('✅ Avatar image loaded:', currentAvatar.image)}
              onError={(e) => console.error('❌ Avatar failed:', currentAvatar.image)}
            />
          </button>
          

        </div>
      ) : (
        // Chef hat shortcut and compact voice button when chef is hidden
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          alignItems: 'center'
        }}>
          <button
            className="chef-hat-shortcut"
            onClick={showChef}
            title="Bring back your chef"
            style={{
              backgroundColor: 'transparent',       // was rgba(...)
              backdropFilter: 'none',                // was blur(12px)
              WebkitBackdropFilter: 'none',         // Safari
              color: 'rgb(75, 85, 99)',
              border: 'none',                       // or keep a transparent ring
              borderRadius: '50%',
              width: '48px',
              height: '48px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'none',                    // optional: remove shadow
              cursor: 'pointer',
              transition: 'transform 0.2s ease'     // only scale on hover
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <ChefHat size={24} className="text-white"/>
          </button>

          
          {/* iOS Voice Button - moved from bottom */}
          <TapToRecordButton />
        </div>
      )}
      
      {settingsOpen && chefVisible && (
        <AvatarSettingsPanel
          selectedAvatar={selectedAvatar}
          setSelectedAvatar={setSelectedAvatar}
          onClose={() => {
            setSettingsOpen(false);
            handleChefInteraction();
          }}
          onHideAvatar={() => {
            setChefVisible(false);
            console.log('🍳 Chef manually hidden by user');
          }}
          onResetAvatarTimer={resetInactivityTimer}
        />
      )}

      {/* Speech Bubble for Accessibility */}
      {speechTextEnabled && (
        <AvatarSpeechBubble
          text={currentSpeechText}
          visible={speechBubbleVisible}
          onClose={hideSpeechBubble}
        />
      )}
    </div>
  );
};