import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Send, X, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { apiUrl } from '@/lib/resolveApiBase';

export const SimpleVoiceRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [supportsMediaRecorder, setSupportsMediaRecorder] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Check device capabilities on mount
  useEffect(() => {
    const checkCapabilities = () => {
      const hasMediaRecorder = 'MediaRecorder' in window;
      const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
      
      setSupportsMediaRecorder(hasMediaRecorder);
      setIsIOS(isIOSDevice);
      
      console.log('🔍 Device capabilities:', {
        hasMediaRecorder,
        isIOSDevice,
        userAgent: navigator.userAgent
      });
    };
    
    checkCapabilities();
  }, []);

  const startRecording = async () => {
    try {
      console.log('🎤 Starting audio recording...');
      
      // Check if MediaRecorder is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Audio recording not supported in this browser');
        return;
      }

      // Check for available audio devices first
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(device => device.kind === 'audioinput');
      console.log('Available audio inputs:', audioInputs.length);
      
      if (audioInputs.length === 0) {
        setError('No microphone detected. Please connect a microphone and refresh.');
        return;
      }

      // Try to get microphone access with fallback constraints
      let stream;
      try {
        // Try with enhanced audio constraints first
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            deviceId: audioInputs[0].deviceId ? { exact: audioInputs[0].deviceId } : undefined
          }
        });
      } catch (constraintError) {
        console.log('Enhanced constraints failed, trying basic audio...');
        // Fallback to basic audio constraints
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      
      console.log('✅ Microphone access granted');
      
      // Check MediaRecorder support with fallback MIME types
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'audio/mp4';
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = ''; // Let browser choose
          }
        }
      }
      
      console.log('Using MIME type:', mimeType);
      
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' });
        setAudioBlob(audioBlob);
        stream.getTracks().forEach(track => track.stop());
        console.log('🎤 Recording stopped, audio blob created');
      };

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        setError('Recording failed');
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(1000); // Record in 1-second chunks
      setIsRecording(true);
      setError(null);
      console.log('🎤 Recording started successfully');
      
    } catch (error) {
      console.error('Recording error:', error);
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          setError('Microphone access denied. Please allow microphone access and try again.');
        } else if (error.name === 'NotFoundError') {
          setError('No microphone found. Please connect a microphone and refresh the page.');
        } else if (error.name === 'NotSupportedError') {
          setError('Audio recording not supported in this browser.');
        } else {
          setError(`Recording failed: ${error.message}`);
        }
      } else {
        setError('Failed to access microphone');
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const sendAudio = async () => {
    if (!audioBlob) return;

    try {
      console.log('📤 Sending audio to backend...');
      const formData = new FormData();
      formData.append('audio', audioBlob, 'voice.webm');

      const response = await fetch(apiUrl('/api/voice/transcribe'), {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Voice transcribed:', data.transcript);
        
        // Process the voice command through existing backend
        const commandResponse = await fetch(apiUrl('/api/voice/parse'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript: data.transcript }),
        });

        if (commandResponse.ok) {
          const commandData = await commandResponse.json();
          console.log('🎯 Voice command processed:', commandData);
          
          // Execute the action if needed
          if (commandData.action && commandData.action !== 'error') {
            // Handle navigation or other actions
            if (commandData.data?.route) {
              window.location.href = commandData.data.route;
            }
          }
        }
        
        setAudioBlob(null);
      } else {
        setError('Failed to process voice recording');
      }
    } catch (error) {
      setError('Failed to send voice recording');
      console.error('Send error:', error);
    }
  };

  const clearRecording = () => {
    setAudioBlob(null);
    setError(null);
  };

  // iOS Safari fallback: file input for audio recording
  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('audio/')) {
      setAudioBlob(file);
      setError(null);
      console.log('📁 Audio file selected:', file.name, file.type);
    } else {
      setError('Please select a valid audio file');
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  if (error) {
    return (
      <div className="fixed bottom-20 right-4 z-50">
        <Card className="shadow-xl border-red-500 border-2">
          <CardContent className="p-4 text-center">
            <div className="text-red-600 text-sm">{error}</div>
            <Button 
              onClick={() => setError(null)} 
              variant="outline" 
              size="sm" 
              className="mt-2"
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isRecording) {
    return (
      <div className="fixed bottom-20 right-4 z-50">
        <Card className="shadow-xl border-red-500 border-2">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Mic className="w-6 h-6 text-red-500 animate-pulse" />
                <div>
                  <h4 className="font-bold text-red-600">Recording</h4>
                  <p className="text-xs text-gray-600">Say "Hey Chef" + command</p>
                </div>
              </div>
              <Button
                onClick={stopRecording}
                variant="destructive"
                size="sm"
              >
                <MicOff className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (audioBlob) {
    return (
      <div className="fixed bottom-20 right-4 z-50">
        <Card className="shadow-xl border-green-500 border-2">
          <CardContent className="p-4 text-center">
            <div className="text-sm text-gray-600 mb-3">Voice recorded</div>
            <div className="flex gap-2">
              <Button onClick={clearRecording} variant="outline" size="sm">
                <X className="w-4 h-4" />
              </Button>
              <Button onClick={sendAudio} size="sm" className="flex items-center gap-2">
                <Send className="w-4 h-4" />
                Send
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // iOS Safari fallback UI
  if (isIOS && !supportsMediaRecorder) {
    return (
      <div className="fixed bottom-20 right-4 z-50">
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          capture="microphone"
          style={{ display: 'none' }}
          onChange={handleFileInput}
        />
        <Button
          onClick={triggerFileInput}
          className="w-14 h-14 rounded-full bg-blue-500 hover:bg-blue-600 shadow-xl"
          title="Record or upload audio (iOS compatible)"
        >
          <Upload className="w-6 h-6 text-white" />
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-20 right-4 z-50">
      <Button
        onClick={startRecording}
        className="w-14 h-14 rounded-full bg-orange-500 hover:bg-orange-600 shadow-xl"
        disabled={!supportsMediaRecorder}
        title={supportsMediaRecorder ? "Tap to record voice" : "Recording not supported in this browser"}
      >
        <Mic className="w-6 h-6 text-white" />
      </Button>
    </div>
  );
};