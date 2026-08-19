// ✅ FINAL FIXED VERSION - ChefVoiceAssistant.tsx
import React, { useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { speakWithElevenLabs } from './elevenLabsClient';
import { AVATAR_FEATURES } from '../config/avatarFlags';
import {
  getSpeechRecognitionConstructor,
  type BrowserSpeechRecognition,
  type SpeechRecognitionErrorEvent,
  type SpeechRecognitionResultEvent,
} from '@/lib/speechRecognition';

const commandsMap: Record<string, string> = {
  // Dashboard and Main Features
  'dashboard': '/dashboard',
  'main dashboard': '/dashboard',
  'home': '/dashboard',
  
  // Meal Creation
  'ai meal creator': '/ai-meal-creator',
  'meal creator': '/ai-meal-creator',
  'craving creator': '/craving-creator',
  'weekly meal planner': '/weekly-meal-board',
  'meal planner': '/weekly-meal-board',
  'weekly meal calendar': '/weekly-meal-board',
  
  // Specialized Hubs
  'meals for kids': '/meals-for-kids',
  'kids meals': '/meals-for-kids',
  'supplement hub': '/supplement-hub',
  'potluck planner': '/potluck-planner',
  'restaurant guide': '/restaurant-guide',
  'fridge rescue': '/fridge-rescue',
  'learn to cook': '/learn-to-cook',
  'cooking tutorials': '/learn-to-cook',
  
  // Logging and Tracking
  'daily journal': '/daily-journal',
  'meal journal': '/daily-journal',
  'journal': '/daily-journal',
  'log meals': '/food',
  'meal logging': '/food',
  'log water': '/track-water',
  'water log': '/track-water',
  'water logging': '/track-water',
  'track water': '/track-water',
  'water intake': '/track-water',
  
  // Health and Biometrics
  'my biometrics': '/my-biometrics',
  'biometrics': '/my-biometrics',
  'weight tracking': '/my-biometrics',
  'womens health': '/womens-health',
  'women\'s health': '/womens-health',
  'mens health': '/mens-health',
  'men\'s health': '/mens-health',
  
  // Games and Entertainment
  'game hub': '/game-hub',
  'games': '/game-hub',
  
  // Legacy routes (keeping for compatibility)
  'regenerate my meal': '/weekly-meal-board',
  'profile': '/my-biometrics'
};

export const ChefVoiceAssistant = () => {
  // Early return if voice features are disabled
  if (!AVATAR_FEATURES.VOICE_ENABLED) {
    return null;
  }
  
  const [, setLocation] = useLocation();
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const isListeningRef = useRef(false);

  useEffect(() => {
    const SpeechRecognition = getSpeechRecognitionConstructor();

    if (!SpeechRecognition) {
      console.warn('SpeechRecognition not supported in this browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event: SpeechRecognitionResultEvent) => {
      const transcript = event.results[event.resultIndex][0].transcript
        .toLowerCase()
        .trim();

      if (transcript.includes('hey chef')) {
        const command = transcript.replace('hey chef', '').trim();

        for (const phrase in commandsMap) {
          if (command.includes(phrase)) {
            const path = commandsMap[phrase];
            speakWithElevenLabs(`Okay, taking you to your ${phrase}.`, 'professional');
            setLocation(path);
            return;
          }
        }

        speakWithElevenLabs("I'm not sure what you meant. Try again.", 'casual');
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
    };

    recognition.onend = () => {
      // Restart only if user didn't manually stop
      if (isListeningRef.current) {
        try {
          recognition.start();
        } catch (err) {
          console.warn('Recognition restart failed:', err);
        }
      }
    };

    recognitionRef.current = recognition;
    isListeningRef.current = true;

    try {
      recognition.start();
    } catch (err) {
      console.error('Initial recognition start failed:', err);
    }

    return () => {
      isListeningRef.current = false;
      recognition.stop();
    };
  }, [setLocation]);

  return null;
};