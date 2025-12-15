// ✅ VoiceConcierge.tsx
// Main orchestrator that processes voice commands and executes actions

import React, { useEffect } from 'react';
import { useLocation } from 'wouter';
import { VoiceProvider, useVoiceContext } from '@/context/VoiceContext';
import { VoiceAssistantManager } from './VoiceAssistantManager';
import { apiUrl } from '@/lib/resolveApiBase';

interface VoiceCommandResponse {
  action: string;
  data?: any;
  speech: string;
}

const VoiceConciergeInner = () => {
  const [, setLocation] = useLocation();
  const { transcript, setTranscript, setIsProcessing, setError, addToConversation } = useVoiceContext();

  // Text-to-speech response
  const speakResponse = (text: string) => {
    if (window.speechSynthesis) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.volume = 0.8;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Process voice commands when transcript changes
  useEffect(() => {
    if (!transcript) return;

    const processCommand = async () => {
      try {
        console.log('🎤 Processing voice command:', transcript);

        const response = await fetch(apiUrl('/api/voice/parse'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript }),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown server error');
          console.error('🚨 Server error:', response.status, errorText);
          throw new Error(`Server error: ${response.status} - Please try again`);
        }

        const data: VoiceCommandResponse = await response.json().catch(error => {
          console.error('🚨 JSON parse error:', error);
          throw new Error('Invalid server response - please try again');
        });
        console.log('✅ Voice command response:', data);

        // Add to conversation history
        addToConversation(transcript, data.speech || 'Action completed');

        // Execute the action
        executeAction(data);

        // Speak the response
        if (data.speech) {
          speakResponse(data.speech);
        }

        setIsProcessing(false);

        // Clear transcript after delay
        setTimeout(() => {
          setTranscript('');
        }, 3000);

      } catch (error) {
        console.error('🚨 Voice command error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Sorry, I had trouble processing your command.';
        setError(errorMessage);
        setIsProcessing(false);

        // Reset after error - shorter timeout for better UX
        setTimeout(() => {
          setTranscript('');
          setError(null);
        }, 3000);
      }
    };

    processCommand();
  }, [transcript, setTranscript, setIsProcessing, setError, setLocation, addToConversation]);

  const executeAction = (response: VoiceCommandResponse) => {
    const { action, data } = response;

    switch (action) {
      case 'navigate':
        if (data.navigateTo) {
        console.log("🧭 Navigating to:", data.navigateTo);
        setLocation(data.navigateTo);
      }

      // Dispatch client events if specified
      if (data.clientEvent) {
        console.log("📡 Dispatching client event:", data.clientEvent);
        window.dispatchEvent(new Event(data.clientEvent));
      }
        break;

      case 'logMeal':
        if (data?.mealType) {
          setLocation(`/meal-logging?meal=${data.mealType}`);
        } else {
          setLocation('/meal-logging');
        }
        break;

      case 'fetchData':
        if (data?.type === 'weight') {
          setLocation('/my-progress?tab=weight');
        } else if (data?.type === 'meals') {
          setLocation('/meal-history');
        } else {
          setLocation('/my-progress');
        }
        break;

      case 'encouragement':
        setLocation('/womens-health');
        break;

      case 'generateMeal':
        if (data?.craving) {
          setLocation(`/craving-creator?craving=${encodeURIComponent(data.craving)}`);
        } else {
          setLocation('/craving-creator');
        }
        break;

      default:
        console.warn('Unknown voice action:', action);
        break;
    }
  };

  return (
    <VoiceAssistantManager />
  );
};

export const VoiceConcierge = () => (
  <VoiceProvider>
    <VoiceConciergeInner />
  </VoiceProvider>
);