import React, { useState, useRef } from 'react';
import { Mic, MicOff, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { apiUrl } from '@/lib/resolveApiBase';

interface VoiceRecorderProps {
  onTranscriptReceived: (transcript: string) => void;
  onError: (error: string) => void;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onTranscriptReceived, onError }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        setAudioBlob(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      onError('Failed to access microphone');
      console.error('Recording error:', error);
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
      const formData = new FormData();
      formData.append('audio', audioBlob, 'voice.wav');

      const response = await fetch(apiUrl('/api/voice/transcribe'), {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        onTranscriptReceived(data.transcript);
        setAudioBlob(null);
      } else {
        onError('Failed to process voice recording');
      }
    } catch (error) {
      onError('Failed to send voice recording');
      console.error('Send error:', error);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardContent className="p-4">
        <div className="flex items-center justify-center gap-4">
          {!isRecording && !audioBlob && (
            <Button onClick={startRecording} className="flex items-center gap-2">
              <Mic className="w-4 h-4" />
              Start Recording
            </Button>
          )}

          {isRecording && (
            <Button onClick={stopRecording} variant="destructive" className="flex items-center gap-2">
              <MicOff className="w-4 h-4" />
              Stop Recording
            </Button>
          )}

          {audioBlob && (
            <div className="flex gap-2">
              <Button onClick={() => setAudioBlob(null)} variant="outline">
                Discard
              </Button>
              <Button onClick={sendAudio} className="flex items-center gap-2">
                <Send className="w-4 h-4" />
                Send Voice
              </Button>
            </div>
          )}
        </div>

        {isRecording && (
          <div className="mt-4 text-center">
            <div className="animate-pulse text-red-500">Recording... Speak now</div>
          </div>
        )}

        {audioBlob && (
          <div className="mt-4 text-center text-sm text-gray-600">
            Voice recorded. Click "Send Voice" to process.
          </div>
        )}
      </CardContent>
    </Card>
  );
};