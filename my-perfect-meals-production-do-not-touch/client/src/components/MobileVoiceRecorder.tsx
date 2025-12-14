import React, { useEffect, useRef, useState } from 'react';
import { Mic, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { apiUrl } from '@/lib/resolveApiBase';

export const MobileVoiceRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      console.log('🎤 Starting recording flow - user gesture detected');
      
      // Check browser support first
      if (!navigator.mediaDevices || !window.MediaRecorder) {
        alert('Your browser does not support audio recording. Please try Chrome or Safari.');
        return;
      }

      console.log('🎤 Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      console.log('✅ Microphone access granted');

      // Create MediaRecorder with enhanced logging
      mediaRecorderRef.current = new MediaRecorder(stream);
      console.log('📱 MediaRecorder created successfully');

      // Add error handler
      mediaRecorderRef.current.onerror = (e) => {
        console.error('💥 MediaRecorder error:', e);
        setIsRecording(false);
      };

      mediaRecorderRef.current.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          audioChunks.current.push(event.data);
          console.log('📊 Audio data chunk received:', event.data.size, 'bytes');
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunks.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setAudioBlob(blob);
        audioChunks.current = [];
        console.log('🎤 Recording stopped, blob created:', blob.size, 'bytes');
        
        // Stop all stream tracks
        stream.getTracks().forEach(track => {
          track.stop();
          console.log('🔇 Audio track stopped');
        });
        
        // Auto-send the audio
        setTimeout(() => {
          sendAudio(blob);
        }, 500);
      };

      // Check state before starting
      console.log("🎤 MediaRecorder state before start:", mediaRecorderRef.current.state);
      
      if (mediaRecorderRef.current.state === "inactive") {
        mediaRecorderRef.current.start(1000); // Record in 1-second chunks
        setIsRecording(true);
        console.log('🔴 Recording started successfully');
      } else {
        console.warn("⚠️ MediaRecorder not inactive, current state:", mediaRecorderRef.current.state);
      }

    } catch (err) {
      console.error('🚫 Error in recording flow:', err);
      if (err.name === 'NotAllowedError') {
        alert('Microphone access denied. Please allow microphone permissions and try again.');
      } else if (err.name === 'NotFoundError') {
        alert('No microphone found. Please connect a microphone and try again.');
      } else {
        alert('Recording failed: ' + err.message);
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      console.log('⏹️ Stop recording requested, current state:', mediaRecorderRef.current.state);
      
      if (mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
        console.log('✅ Recording stopped');
      } else {
        console.warn('⚠️ MediaRecorder not in recording state:', mediaRecorderRef.current.state);
        setIsRecording(false);
      }
    }
  };



  const sendAudio = async (blob?: Blob) => {
    const audioToSend = blob || audioBlob;
    if (!audioToSend) return;

    setIsProcessing(true);
    try {
      console.log('📤 Sending audio to backend...');
      const formData = new FormData();
      formData.append('audio', audioToSend, 'voice-recording');

      const response = await fetch(apiUrl('/api/voice/transcribe'), {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Voice transcribed:', data.transcript);
        
        // Process the voice command
        const commandResponse = await fetch(apiUrl('/api/voice/parse'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript: data.transcript }),
        });

        if (commandResponse.ok) {
          const commandData = await commandResponse.json();
          console.log('🎯 Voice command processed:', commandData);
          
          if (commandData.action && commandData.action !== 'error') {
            if (commandData.data?.route) {
              window.location.href = commandData.data.route;
            }
          }
        }
        
        setAudioBlob(null);
        setAudioUrl(null);
      } else {
        console.error('Failed to process voice recording');
      }
    } catch (error) {
      console.error('Send error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const clearRecording = () => {
    setAudioBlob(null);
    setAudioUrl(null);
  };

  // Show recording in progress
  if (isRecording) {
    return (
      <div className="fixed bottom-20 right-4 z-50">
        <Card className="shadow-xl border-red-500 border-2">
          <CardContent className="p-4 text-center">
            <div className="flex items-center gap-2">
              <Mic className="w-6 h-6 text-red-500 animate-pulse" />
              <div>
                <h4 className="font-bold text-red-600">Recording</h4>
                <p className="text-xs text-gray-600">Say "Hey Chef" + command</p>
              </div>
              <Button onClick={stopRecording} variant="destructive" size="lg" className="px-6 py-3">
                Stop Recording
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show audio ready to send (if manual send needed)
  if (audioBlob && !isProcessing) {
    return (
      <div className="fixed bottom-20 right-4 z-50">
        <Card className="shadow-xl border-green-500 border-2">
          <CardContent className="p-4 text-center">
            <div className="text-sm text-gray-600 mb-3">Audio ready</div>
            <div className="flex gap-3">
              <Button onClick={clearRecording} variant="outline" size="lg" className="px-4 py-3">
                <X className="w-6 h-6" />
              </Button>
              <Button 
                onClick={() => sendAudio()} 
                size="lg" 
                className="flex items-center gap-2 px-6 py-3"
              >
                <Send className="w-6 h-6" />
                Send
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Processing state
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

  // Main recording button with clear tap-to-record instruction
  return (
    <div className="fixed bottom-20 right-4 z-50">
      <div className="text-center mb-2">
        <div className="text-sm text-gray-600 bg-white dark:bg-gray-800 px-3 py-2 rounded-lg shadow">
          Tap to Speak
        </div>
      </div>
      <Button
        onClick={isRecording ? stopRecording : startRecording}
        className={`w-24 h-24 rounded-full shadow-xl transition-all ${
          isRecording 
            ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
            : 'bg-blue-500 hover:bg-blue-600'
        }`}
        title={isRecording ? 'Tap to stop recording' : 'Tap to start recording'}
      >
        <Mic className="w-12 h-12 text-white" />
      </Button>
    </div>
  );
};