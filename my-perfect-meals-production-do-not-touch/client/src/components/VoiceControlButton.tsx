import React, { useState, useRef } from 'react';
import { useVoiceContext } from '@/context/VoiceContext';
import { Card, CardContent } from '@/components/ui/card';
import { Mic, MicOff, Volume2, X } from 'lucide-react';

export const VoiceControlButton = () => {
  const { isListening, setIsListening, setTranscript, setIsProcessing, setError } = useVoiceContext();
  const [voiceActive, setVoiceActive] = useState(false);
  const [wakeWordHeard, setWakeWordHeard] = useState(false);
  const recognitionRef = useRef<any>(null);

  const startVoiceRecognition = async () => {
    try {
      // Debug: Check current permissions
      console.log('🔍 Checking permissions...');
      console.log('Location protocol:', window.location.protocol);
      console.log('Location hostname:', window.location.hostname);
      
      // Check if we're in a secure context
      if (!window.isSecureContext && window.location.hostname !== 'localhost') {
        setError('Voice recognition requires HTTPS or localhost');
        return;
      }
      
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        setError('Speech recognition not supported in this browser');
        return;
      }

      console.log('🎤 Initializing speech recognition...');
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      recognitionRef.current = recognition;

      recognition.onstart = () => {
        setIsListening(true);
        setVoiceActive(true);
        setError(null);
      };

      recognition.onresult = (event: any) => {
        const latest = event.results[event.results.length - 1];
        if (latest.isFinal) {
          const transcript = latest[0].transcript.toLowerCase().trim();
          
          // Check for wake words
          if (!wakeWordHeard && (transcript.includes('hey chef') || transcript.includes('chef'))) {
            setWakeWordHeard(true);
            return;
          }

          // Process command after wake word
          if (wakeWordHeard) {
            recognition.stop();
            setWakeWordHeard(false);
            setIsProcessing(true);
            setTranscript(transcript);
          }
        }
      };

      recognition.onerror = (event: any) => {
        console.error('🚨 Voice recognition error:', {
          error: event.error,
          message: event.message,
          timeStamp: event.timeStamp,
          protocol: window.location.protocol,
          hostname: window.location.hostname
        });
        
        if (event.error === 'not-allowed') {
          setError('Browser blocked microphone access. Try refreshing the page or check browser permissions.');
        } else if (event.error === 'no-speech') {
          // Ignore no speech errors, continue listening
          return;
        } else if (event.error === 'audio-capture') {
          setError('Microphone hardware issue detected');
        } else if (event.error === 'network') {
          setError('Network error - check internet connection');
        } else {
          setError(`Voice error: ${event.error} - Try refreshing the page`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        if (voiceActive && recognitionRef.current) {
          setTimeout(() => {
            try {
              recognition.start();
            } catch (error) {
              console.log('Recognition restart failed, stopping voice');
              setVoiceActive(false);
            }
          }, 1000);
        }
      };

      console.log('🚀 Starting speech recognition...');
      recognition.start();
      
    } catch (error) {
      console.error('🚨 Voice recognition start error:', error);
      setError(`Failed to start voice recognition: ${error.message || error}. Try refreshing the page.`);
    }
  };

  const stopVoiceRecognition = () => {
    setVoiceActive(false);
    setIsListening(false);
    setWakeWordHeard(false);
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  };

  if (voiceActive) {
    return (
      <div className="fixed bottom-20 right-4 z-50">
        <Card className="shadow-xl border-green-500 border-2">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Mic className={`w-6 h-6 text-green-500 ${isListening ? 'animate-pulse' : ''}`} />
                <div>
                  <h4 className="font-bold text-green-600">Voice Active</h4>
                  <p className="text-xs text-gray-600">Say "Hey Chef"</p>
                </div>
              </div>
              <button
                onClick={stopVoiceRecognition}
                className="p-1 text-gray-400 hover:text-red-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed bottom-20 right-4 z-50">
      <Card className="shadow-xl border-orange-500 border-2">
        <CardContent className="p-4 text-center">
          <div className="flex flex-col items-center gap-3">
            <Volume2 className="w-8 h-8 text-orange-500" />
            <h4 className="font-bold text-orange-600">Enable Voice Commands</h4>
            <p className="text-sm text-gray-600 mb-2">
              Say "Hey Chef" to control your meal planning
            </p>
            <button
              onClick={startVoiceRecognition}
              className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors"
            >
              <Mic className="w-4 h-4" />
              Start Voice Commands
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};