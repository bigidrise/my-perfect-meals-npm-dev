// 🔒 LOCKED - DO NOT EDIT - Critical voice system - Approved for production as of January 8, 2025
// client/src/components/TapToRecordButton.tsx
import React, { useRef, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Send, X } from "lucide-react";
import { Card, CardContent } from '@/components/ui/card';
import { useLocation } from "wouter";
import { AVATAR_FEATURES } from '../config/avatarFlags';
import { apiUrl } from '@/lib/resolveApiBase';

const TapToRecordButton: React.FC = () => {
  // Early return if voice features are disabled
  if (!AVATAR_FEATURES.VOICE_ENABLED) {
    return null;
  }

  const [, setLocation] = useLocation();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startRecording = async () => {
    setError(null);
    console.log("🎤 User gesture detected - requesting microphone access...");

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
          setTimeout(async () => {
            console.log("📤 Auto-sending audio blob...");
            try {
              await sendAudioBlob(blob);
            } catch (error) {
              console.error("Failed to process audio:", error);
              setError("Failed to process voice command. Please try again.");
              setAudioBlob(null);
              setIsRecording(false);
            }
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

        // Auto-stop after 20 seconds to prevent infinite recording
        setTimeout(() => {
          if (recorder.state === 'recording') {
            console.log("⏰ Auto-stopping recording after 20 seconds");
            recorder.stop();
            setIsRecording(false);
          }
        }, 20000);
      } else {
        setError("Recorder is already active or unavailable.");
      }
    } catch (err) {
      console.error("🚫 Error accessing microphone:", err);
      const error = err as any;
      if (error.name === 'NotAllowedError') {
        setError("Microphone access denied. Please allow microphone permissions.");
      } else if (error.name === 'NotFoundError') {
        setError("No microphone found. Please connect a microphone.");
      } else {
        setError("Failed to access microphone: " + (error.message || 'Unknown error'));
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      console.log("⏹️ Stop recording requested, current state:", mediaRecorderRef.current.state);
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      console.log("✅ Recording stopped");
    }
  };

  const sendAudioBlob = async (blob: Blob) => {
    setIsProcessing(true);
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

          // Special handling for voice meal logging
          if (hardcodedRoute === "VOICE_MEAL_LOG") {
            console.log('🍽️ Processing voice meal logging directly');
            try {
              const response = await fetch(apiUrl('/api/voice/log-meal'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  transcript: data.transcript,
                  userId: '1' // TODO: Get from auth context
                })
              });

              if (response.ok) {
                const result = await response.json();
                console.log('✅ Voice meal logged successfully:', result);
                await speakResponse(result.speech);
                setAudioBlob(null);
                return;
              } else {
                console.error('❌ Voice meal logging failed:', response.status);
                await speakResponse("Sorry, I couldn't log your meal right now. Please try again.");
              }
            } catch (error) {
              console.error('❌ Voice meal logging error:', error);
              await speakResponse("Sorry, I couldn't log your meal right now. Please try again.");
            }
            setAudioBlob(null);
            return;
          }

          // Generate appropriate response for regular navigation routes
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError('Failed to send voice recording: ' + errorMessage);
      console.error('Send error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const sendAudio = async () => {
    if (!audioBlob) return;
    await sendAudioBlob(audioBlob);
  };

  // Hardcoded command processing for instant responses
  const processHardcodedCommands = (transcript: string): string | null => {
    const cleaned = transcript.toLowerCase();

    // General questions/greetings
    if (cleaned.includes("what's going on") || cleaned.includes("what's up") || cleaned.includes("how are you")) {
      return "/dashboard";
    }

    if (cleaned.includes("help") || cleaned.includes("what can you do")) {
      return "/dashboard";
    }

    // Food/meal related
    if (cleaned.includes("breakfast") || cleaned.includes("what's for") || cleaned.includes("hungry") || cleaned.includes("eat")) {
      return "/craving-creator";
    }

    if (cleaned.includes("restaurant") || cleaned.includes("dining out")) {
      return "/restaurant-guide";
    }

    // Health/tracking
    if (cleaned.includes("weigh") || cleaned.includes("weight") || cleaned.includes("progress") || cleaned.includes("track")) {
      return "/my-progress";
    }

    if (cleaned.includes("log") && (cleaned.includes("meal") || cleaned.includes("food"))) {
      return "/food"; // Navigate to unified food logging page
    }

    // Navigation
    if (cleaned.includes("dashboard") || cleaned.includes("home") || cleaned.includes("main")) {
      return "/dashboard";
    }

    if (cleaned.includes("kids") || cleaned.includes("children")) {
      return "/meals-for-kids";
    }

    if (cleaned.includes("weekly") || cleaned.includes("meal plan")) {
      return "/comprehensive-meal-planning-revised";
    }

    if (cleaned.includes("cooking") || cleaned.includes("learn") || cleaned.includes("tutorial")) {
      return "/learn-to-cook";
    }

    if (cleaned.includes("alcohol") || cleaned.includes("drinks") || cleaned.includes("spirits") || cleaned.includes("lifestyle")) {
      return "/alcohol-hub";
    }

    if (cleaned.includes("potluck") || cleaned.includes("party") || cleaned.includes("event")) {
      return "/potluck-planner";
    }

    // Blood Sugar Hub - Most specific first
    if (cleaned.includes("blood sugar") || cleaned.includes("glucose") || cleaned.includes("diabetes") || cleaned.includes("blood sugar hub")) {
      return "/blood-sugar-hub";
    }

    // Women's Health Hub - Check for women's before generic health
    if (cleaned.includes("women's health") || cleaned.includes("womens health") || cleaned.includes("women health")) {
      return "/womens-health-hub";
    }

    // Men's Health Hub - Check for men's before generic health
    if (cleaned.includes("men's health") || cleaned.includes("mens health") || cleaned.includes("men health")) {
      return "/mens-health-hub";
    }

    // Generic health/wellness (fallback to men's health for now)
    if (cleaned.includes("encouragement") || cleaned.includes("bad day") || cleaned.includes("wellness")) {
      return "/mens-health-hub";
    }

    return null;
  };

  // Generate appropriate spoken responses for hardcoded commands
  const getHardcodedResponse = (transcript: string, route: string): string => {
    const cleaned = transcript.toLowerCase();

    if (cleaned.includes("what's going on") || cleaned.includes("what's up")) {
      return "Let me show you your dashboard to see what's happening with your health journey!";
    }

    if (cleaned.includes("help") || cleaned.includes("what can you do")) {
      return "I can help you with meal planning, nutrition tracking, and health monitoring. Let me show you around!";
    }

    if (cleaned.includes("breakfast") || cleaned.includes("hungry") || cleaned.includes("eat")) {
      return "Let me help you create a delicious meal! What are you craving today?";
    }

    if (cleaned.includes("restaurant")) {
      return "Opening the restaurant guide to help you find healthy dining options!";
    }

    if (cleaned.includes("weight") || cleaned.includes("progress")) {
      return "Let me check your health progress and weight tracking for you.";
    }

    if (cleaned.includes("log") && (cleaned.includes("meal") || cleaned.includes("food"))) {
      return "Let me help you log your meal. What did you eat?";
    }

    if (route === "/dashboard") {
      return "Taking you to your main dashboard!";
    }

    if (route === "/comprehensive-meal-planning-revised") {
      return "Let me help you plan your meals! Opening the meal planning hub.";
    }

    if (route === "/learn-to-cook") {
      return "Opening cooking tutorials to help you learn new skills!";
    }

    if (route === "/blood-sugar-hub") {
      return "Opening Blood Sugar Hub to help you track your glucose and manage your diabetes!";
    }

    if (route === "/womens-health-hub") {
      return "Opening Women's Health Hub for wellness and health guidance!";
    }

    if (route === "/mens-health-hub") {
      return "Let me help you with wellness and health tips.";
    }

    if (route === "/alcohol-hub") {
      return "Opening the Alcohol and Lifestyle Spirits Hub for you!";
    }

    if (route === "/potluck-planner") {
      return "Opening Potluck Planner to help you plan the perfect party menu!";
    }

    return "Let me help you with that!";
  };

  // Trigger TTS speech using ElevenLabs client
  const speakResponse = async (text: string): Promise<void> => {
    try {
      console.log('🎤 Chef speaking with ElevenLabs:', text);

      // Use the existing ElevenLabs client that's already working for avatar greetings
      const { speakWithElevenLabs } = await import('./elevenLabsClient');
      await speakWithElevenLabs(text, 'friendly');
      console.log('✅ ElevenLabs voice command response played');

    } catch (error) {
      console.error('ElevenLabs speech error:', error);

      // Only use browser fallback as last resort
      console.warn('Falling back to browser TTS due to ElevenLabs error');
      if ("speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "en-US";
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
        console.log('✅ Browser TTS fallback used');
      }
    }
  };

  const clearRecording = () => {
    setAudioBlob(null);
    setError(null);
  };

  // Show processing state
  if (isProcessing) {
    return (
      <div className="fixed bottom-20 right-4 z-50">
        <Card className="shadow-xl border-blue-500 border-2">
          <CardContent className="p-4 text-center">
            <div className="text-sm text-gray-600">Processing voice...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show audio ready to send
  if (audioBlob) {
    return (
      <div className="fixed bottom-20 right-4 z-50">
        <Card className="shadow-xl border-green-500 border-2">
          <CardContent className="p-4 text-center">
            <div className="text-sm text-gray-600 mb-3">Audio ready</div>
            <div className="flex gap-2">
              <Button onClick={clearRecording} variant="outline" size="sm">
                <X className="w-4 h-4" />
              </Button>
              <Button 
                onClick={sendAudio} 
                size="sm" 
                className="flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                Send
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show recording in progress (compact)
  if (isRecording) {
    return (
      <div className="relative">
        <Button 
          onClick={stopRecording} 
          className="w-8 h-8 rounded-full bg-red-500 hover:bg-red-600 shadow-lg transition-all animate-pulse"
          title="Stop recording"
          size="sm"
        >
          <MicOff className="w-4 h-4 text-white" />
        </Button>
      </div>
    );
  }

  // Main tap-to-record button (glass + mostly click-through)
  return (
    // Wrapper does NOT intercept clicks anywhere by default
    <div className="relative pointer-events-none">
      {/* Transparent disc (completely pass-through) */}
      <div
        className="pointer-events-none w-8 h-8 rounded-full"
      >
        {/* Small inner clickable area only around the icon */}
        <Button 
          onClick={startRecording} 
          className="pointer-events-auto absolute inset-0 m-auto w-6 h-6 rounded-full
                     flex items-center justify-center text-blue-600 bg-transparent hover:bg-blue-500/20
                     border-0 p-0 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400"
          title="Tap to speak"
          size="sm"
          style={{ inset: 0 }}
        >
          <Mic className="w-3 h-3" />
        </Button>
      </div>
      {error && (
        <div className="pointer-events-auto absolute top-full mt-2 right-0 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 text-xs p-2 rounded shadow max-w-xs z-10">
          {error}
        </div>
      )}
    </div>
  );
};

export default TapToRecordButton;