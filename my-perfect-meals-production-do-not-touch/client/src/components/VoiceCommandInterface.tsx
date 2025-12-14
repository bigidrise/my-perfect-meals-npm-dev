// ✅ VoiceCommandInterface.tsx
import React, { useContext } from 'react';
import { useVoiceContext } from '@/context/VoiceContext';
import { LoaderCircle, Mic, MicOff, XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export const VoiceCommandInterface = () => {
  const {
    isListening,
    isProcessing,
    transcript,
    error,
    resetTranscript,
  } = useVoiceContext();

  if (!isListening && !isProcessing && !transcript && !error) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:bottom-20 sm:right-4 sm:left-auto z-50 w-auto sm:w-[90vw] sm:max-w-sm">
      <Card className="shadow-xl border-orange-500 border-2 animate-fade-in">
        <CardContent className="p-4 flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <h4 className="font-bold text-lg text-orange-600">
              {error ? 'Voice Error' : isProcessing ? 'Chef Thinking...' : 'Chef is Listening...'}
            </h4>
            <button onClick={resetTranscript}>
              <XCircle className="text-gray-400 hover:text-red-500 w-6 h-6" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {isProcessing ? (
              <LoaderCircle className="animate-spin text-orange-500" />
            ) : isListening ? (
              <Mic className="text-orange-500 animate-pulse" />
            ) : error ? (
              <MicOff className="text-red-500" />
            ) : null}
            <p className="text-gray-800">
              {error ? (
                <span className="text-red-600">{error}</span>
              ) : isProcessing ? (
                <span className="text-orange-600">Processing your request...</span>
              ) : transcript ? (
                <span className="text-green-600">"{transcript}"</span>
              ) : (
                'Say "Hey Chef" to start...'
              )}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};