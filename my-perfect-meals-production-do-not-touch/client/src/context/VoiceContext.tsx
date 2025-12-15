import React, { createContext, useState, useCallback, ReactNode, useContext } from 'react';

interface ConversationEntry {
  user: string;
  chef: string;
}

interface VoiceContextType {
  transcript: string;
  setTranscript: (text: string) => void;
  isListening: boolean;
  setIsListening: (state: boolean) => void;
  isProcessing: boolean;
  setIsProcessing: (state: boolean) => void;
  conversationHistory: ConversationEntry[];
  addToConversation: (user: string, chef: string) => void;
  // Legacy compatibility
  listening: boolean;
  setListening: (state: boolean) => void;
  processing: boolean;
  setProcessing: (state: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;
  resetTranscript: () => void;
}

export const VoiceContext = createContext<VoiceContextType>({
  transcript: '',
  setTranscript: () => {},
  isListening: false,
  setIsListening: () => {},
  isProcessing: false,
  setIsProcessing: () => {},
  conversationHistory: [],
  addToConversation: () => {},
  // Legacy compatibility
  listening: false,
  setListening: () => {},
  processing: false,
  setProcessing: () => {},
  error: null,
  setError: () => {},
  resetTranscript: () => {},
});

export const useVoiceContext = () => {
  const context = useContext(VoiceContext);
  if (!context) {
    throw new Error('useVoiceContext must be used within a VoiceProvider');
  }
  return context;
};

export const VoiceProvider = ({ children }: { children: ReactNode }) => {
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<ConversationEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const addToConversation = useCallback((user: string, chef: string) => {
    setConversationHistory((prev) => [...prev, { user, chef }]);
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setError(null);
    setIsProcessing(false);
  }, []);

  // Legacy compatibility aliases
  const listening = isListening;
  const setListening = setIsListening;
  const processing = isProcessing;
  const setProcessing = setIsProcessing;

  return (
    <VoiceContext.Provider
      value={{
        transcript,
        setTranscript,
        isListening,
        setIsListening,
        isProcessing,
        setIsProcessing,
        conversationHistory,
        addToConversation,
        // Legacy compatibility
        listening,
        setListening,
        processing,
        setProcessing,
        error,
        setError,
        resetTranscript,
      }}>
      {children}
    </VoiceContext.Provider>
  );
};