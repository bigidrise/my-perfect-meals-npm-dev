// VoiceAssistantManager.tsx - Complete Voice Concierge System
import React from 'react';
import { VoiceCommandInterface } from './VoiceCommandInterface';
import { ConversationPanel } from './ConversationPanel';
import TapToRecordButton from './TapToRecordButton';
import { VoiceProvider } from '@/context/VoiceContext';

/**
 * VoiceAssistantManager - Complete voice concierge system
 * 
 * Features:
 * - "Hey Chef" wake word detection
 * - Voice-to-text processing
 * - Natural language command understanding
 * - Visual feedback and conversation history
 * - Mobile-optimized interface
 * - ElevenLabs TTS integration
 * 
 * Usage:
 * Simply add <VoiceAssistantManager /> to any page to enable
 * complete voice concierge functionality.
 */
export const VoiceAssistantManager = () => {
  return (
    <VoiceProvider>
      <VoiceCommandInterface />
      <ConversationPanel />
    </VoiceProvider>
  );
};