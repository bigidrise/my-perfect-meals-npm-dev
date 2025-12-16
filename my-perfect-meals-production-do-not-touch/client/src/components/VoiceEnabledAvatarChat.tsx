import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Send, Settings, Volume2, VolumeX, Minimize2, Mic, MicOff } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AvatarSelector } from './AvatarSelector';
import { AvatarSettingsPanel } from './AvatarSettingsPanel';
import { apiUrl } from '@/lib/resolveApiBase';
// AvatarCustomization removed - will be replaced with new system
interface AvatarConfig {
  appearance: string;
  personality: string;
  voiceType: string;
  name: string;
  voiceEnabled: boolean;
}
// All chef avatar components removed - will be replaced with new system

interface Message {
  id: string;
  text: string;
  sender: "user" | "avatar";
  timestamp: Date;
}

interface VoiceEnabledAvatarChatProps {
  isOpen: boolean;
  onClose: () => void;
  avatarConfig: AvatarConfig;
  onAvatarConfigChange: (config: AvatarConfig) => void;
  selectedAvatar?: string;
  setSelectedAvatar?: (avatar: string) => void;
}

export default function VoiceEnabledAvatarChat({
  isOpen,
  onClose,
  avatarConfig,
  onAvatarConfigChange
}: VoiceEnabledAvatarChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(avatarConfig.voiceEnabled);
  const [showAvatarSettings, setShowAvatarSettings] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState(() => {
    return localStorage.getItem('selectedAvatar') || 'blackMale';
  });
  // showCustomization removed - will be replaced with new system
  // showChefBuilder removed - will be replaced with new system
  const [isListening, setIsListening] = useState(false);
  const [lastActiveTime, setLastActiveTime] = useState(Date.now());

  // Sync voice enabled state with avatar config
  React.useEffect(() => {
    setVoiceEnabled(avatarConfig.voiceEnabled);
  }, [avatarConfig.voiceEnabled]);

  // Chef avatar configuration removed - will be replaced with new system

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const speechSynthesis = useRef<SpeechSynthesis | null>(null);
  const recognitionRef = useRef<any>(null);
  const [location] = useLocation();

  // Get user data for context
  const { data: userProfile } = useQuery({ queryKey: ["/api/profile"] });
  const { data: userData } = useQuery({ queryKey: ["/api/users/1"] });
  const { data: streakData } = useQuery({ queryKey: ["userStreak", 1] });
  const { data: badgeData } = useQuery({ queryKey: ["userBadges", 1] });

  // Initialize speech synthesis and recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if ('speechSynthesis' in window) {
        speechSynthesis.current = window.speechSynthesis;
      }

      // Initialize Speech Recognition
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
          setIsListening(true);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
        };

        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setInputText(transcript);
          // Auto-submit after voice input with smart timing
          setTimeout(() => {
            if (transcript.trim() && transcript.length > 2) {
              handleSendMessage(transcript);
              setInputText(""); // Clear input after sending
            }
          }, 800); // Slightly longer delay for better accuracy
        };

        recognitionRef.current = recognition;
      }
    }

    // Check for proactive greeting
    checkForProactiveGreeting();
  }, []);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Track activity for proactive engagement
  useEffect(() => {
    const handleActivity = () => {
      setLastActiveTime(Date.now());
      localStorage.setItem('lastActiveTime', Date.now().toString());
    };

    window.addEventListener('click', handleActivity);
    window.addEventListener('keypress', handleActivity);

    return () => {
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('keypress', handleActivity);
    };
  }, []);

  const checkForProactiveGreeting = () => {
    const lastActive = localStorage.getItem('lastActiveTime');
    const now = Date.now();
    const fourHours = 4 * 60 * 60 * 1000;

    if (!lastActive || (now - parseInt(lastActive)) > fourHours) {
      // Show proactive greeting after a delay to avoid interrupting user workflow
      setTimeout(() => {
        const userName = (userData as any)?.firstName || "Coach";
        const streak = (streakData as any)?.currentStreak?.dayCount || 0;

        const greetingMessage: Message = {
          id: Date.now().toString(),
          text: `Hey ${userName}, welcome back! ${streak > 0 ? `You're on a ${streak}-day streak - fantastic work! ` : ''}I noticed you haven't been active for a while. Need help navigating anything or want to check your progress?`,
          sender: "avatar",
          timestamp: new Date()
        };
        setMessages([greetingMessage]);
        speakText(greetingMessage.text);
      }, 3000); // Increased delay for better UX

      localStorage.setItem('lastActiveTime', now.toString());
    }
  };

  const getPersonalityConfig = () => {
    const appearances = {
      professional: "👩‍💼",
      friendly: "😊", 
      casual: "🤗",
      elegant: "✨"
    };

    const personalities = {
      chef: { name: "Chef Maya", greeting: "Welcome to your culinary journey!" },
      trainer: { name: "Trainer Alex", greeting: "Ready to crush those fitness goals?" },
      nutritionist: { name: "Dr. Sarah", greeting: "Let's optimize your nutrition today!" },
      concierge: { name: "Maya", greeting: "Hi there! I'm your personal health concierge." }
    };

    return {
      emoji: appearances[avatarConfig.appearance as keyof typeof appearances] || "😊",
      name: avatarConfig.name || personalities[avatarConfig.personality as keyof typeof personalities]?.name || "Maya",
      greeting: personalities[avatarConfig.personality as keyof typeof personalities]?.greeting || "Hello!",
      voiceType: avatarConfig.voiceType
    };
  };

  const speakText = (text: string) => {
    if (!avatarConfig.voiceEnabled || !speechSynthesis.current) return;

    speechSynthesis.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const config = getPersonalityConfig();

    // Configure voice based on user selection
    const voices = speechSynthesis.current.getVoices();
    let preferredVoice;

    switch (config.voiceType) {
      case "warm-female":
        preferredVoice = voices.find(v => 
          (v.lang === 'en-US' || v.lang.startsWith('en-US')) && 
          !v.name.toLowerCase().includes('male') &&
          (v.name.toLowerCase().includes('samantha') || v.name.toLowerCase().includes('karen') || v.name.toLowerCase().includes('allison'))
        ) || voices.find(v => (v.lang === 'en-US' || v.lang.startsWith('en-US')) && !v.name.toLowerCase().includes('male'));
        break;
      case "professional-female":
        preferredVoice = voices.find(v => 
          (v.lang === 'en-US' || v.lang.startsWith('en-US')) && 
          !v.name.toLowerCase().includes('male') &&
          (v.name.toLowerCase().includes('victoria') || v.name.toLowerCase().includes('susan') || v.name.toLowerCase().includes('ava'))
        ) || voices.find(v => (v.lang === 'en-US' || v.lang.startsWith('en-US')) && !v.name.toLowerCase().includes('male'));
        break;
      case "friendly-male":
        preferredVoice = voices.find(v => 
          (v.lang === 'en-US' || v.lang.startsWith('en-US')) && 
          v.name.toLowerCase().includes('male') &&
          (v.name.toLowerCase().includes('daniel') || v.name.toLowerCase().includes('tom') || v.name.toLowerCase().includes('fred'))
        ) || voices.find(v => (v.lang === 'en-US' || v.lang.startsWith('en-US')) && v.name.toLowerCase().includes('male'));
        break;
      case "calm-male":
        preferredVoice = voices.find(v => 
          (v.lang === 'en-US' || v.lang.startsWith('en-US')) && 
          v.name.toLowerCase().includes('male') &&
          (v.name.toLowerCase().includes('alex') || v.name.toLowerCase().includes('aaron') || v.name.toLowerCase().includes('nathan'))
        ) || voices.find(v => (v.lang === 'en-US' || v.lang.startsWith('en-US')) && v.name.toLowerCase().includes('male'));
        break;
    }

    if (!preferredVoice) {
      preferredVoice = voices.find(voice => voice.lang === 'en-US' || voice.lang.startsWith('en-US')) 
                  || voices.find(voice => voice.lang.startsWith('en-')) 
                  || voices[0];
    }

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 0.8;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    speechSynthesis.current.speak(utterance);
  };

  const getContextualInfo = () => {
    const currentPage = location;
    const userName = (userData as any)?.firstName || "there";
    const streak = (streakData as any)?.currentStreak?.dayCount || 0;
    const badges = Array.isArray(badgeData) ? badgeData.length : 0;

    return {
      currentPage,
      userName,
      streak,
      badges
    };
  };

  const generateAvatarResponse = async (userMessage: string) => {
    const context = getContextualInfo();

    try {
      const response = await fetch(apiUrl('/api/avatar-assistant/ask'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          context: context
        })
      });

      const data = await response.json();
      
      // Handle navigation if provided
      if (data.navigateTo) {
        console.log('🧭 Avatar navigation triggered:', data.navigateTo);
        // Use wouter's setLocation to navigate
        window.history.pushState({}, '', data.navigateTo);
        window.dispatchEvent(new PopStateEvent('popstate'));
        
        return data.text || data.captions || "Taking you there now!";
      }
      
      return data.text || data.captions || data.response || "I'm here to help! What would you like to know about the app?";
    } catch (error) {
      console.error('Avatar response error:', error);
      return "I'm having trouble connecting right now, but I'm still here to help guide you through the app!";
    }
  };

  const handleSendMessage = async (messageText?: string) => {
    const text = messageText || inputText;
    if (!text.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: text,
      sender: "user", 
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText("");
    setIsLoading(true);

    try {
      const response = await generateAvatarResponse(text);

      const avatarMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: response,
        sender: "avatar",
        timestamp: new Date()
      };

      setMessages(prev => [...prev, avatarMessage]);
      speakText(response);
    } catch (error) {
      console.error('Error getting avatar response:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      recognitionRef.current.start();
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  };

  // getAvatarEmotion removed - will be replaced with new chef system

  const getAvatarGradient = () => {
    const gradients = {
      chef: "from-orange-400 to-red-500",
      trainer: "from-green-400 to-blue-500", 
      nutritionist: "from-emerald-400 to-teal-500",
      concierge: "from-purple-400 to-indigo-500"
    };
    return gradients[avatarConfig.personality as keyof typeof gradients] || gradients.concierge;
  };

  if (!isOpen) return null;

  const config = getPersonalityConfig();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-gradient-to-br from-purple-900/20 to-blue-900/20 backdrop-blur-sm z-50"
    >
      <div className="h-full flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.8, y: 50 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.8, y: 50 }}
          className="w-full max-w-xl h-[50vh] bg-white rounded-lg shadow-lg overflow-hidden"
        >
          {/* Header */}
          <div className={`bg-gradient-to-r ${getAvatarGradient()} text-white p-3`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {/* Large Animated Chef Avatar */}
                <motion.div
                  animate={{
                    scale: isLoading ? [1, 1.1, 1] : isSpeaking ? [1, 1.05, 1] : 1,
                    rotate: isListening ? [0, -5, 5, 0] : 0
                  }}
                  transition={{
                    duration: isLoading ? 0.8 : isSpeaking ? 0.5 : 0.3,
                    repeat: (isLoading || isSpeaking) ? Infinity : 0,
                  }}
                  className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm p-1 cursor-pointer"
                  onClick={() => setShowAvatarSettings(!showAvatarSettings)}
                  title="Click to customize your chef avatar"
                >
                  <AvatarSelector />
                </motion.div>
                <div>
                  <h1 className="text-lg font-bold">{config.name}</h1>
                  <p className="text-sm text-white/80">Health Assistant</p>
                  {isLoading && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-sm text-white/60 mt-1"
                    >
                      🤔 Thinking...
                    </motion.p>
                  )}
                  {isSpeaking && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-sm text-white/60 mt-1"
                    >
                      🔊 Speaking...
                    </motion.p>
                  )}
                  {isListening && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-sm text-white/60 mt-1"
                    >
                      👂 Listening...
                    </motion.p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  disabled
                  variant="ghost"
                  size="sm"
                  className="text-white/50 cursor-not-allowed"
                  title="Coming Soon: New Settings"
                >
                  <Settings className="w-5 h-5" />
                </Button>
                <Button
                  onClick={() => setVoiceEnabled(!voiceEnabled)}
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/20"
                >
                  {voiceEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                </Button>
                <Button
                  onClick={onClose}
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/20"
                >
                  <Minimize2 className="w-5 h-5" />
                </Button>
                <Button
                  onClick={onClose}
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/20"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Chat Area */}
          <div className="flex-1 flex flex-col h-full">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              <AnimatePresence>
                {messages.map(message => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[70%] p-2 rounded-lg ${
                      message.sender === 'user' 
                        ? `bg-gradient-to-r ${getAvatarGradient()} text-white` 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      <p className="text-sm">{message.text}</p>
                      <p className={`text-xs mt-2 ${
                        message.sender === 'user' ? 'text-white/70' : 'text-gray-500'
                      }`}>
                        {message.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start"
                >
                  <div className="bg-gray-100 p-4 rounded-2xl">
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    </div>
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-3 border-t border-gray-200 bg-gray-50">
              <div className="space-y-3">
                {/* Text Input Section */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 block">
                    💬 Type your question:
                  </label>
                  <div className="flex gap-2">
                    <Input
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder={isListening ? "Listening..." : "Type your question here... (e.g., How do I log a meal?)"}
                      onKeyPress={(e) => e.key === 'Enter' && !isLoading && handleSendMessage()}
                      className="flex-1 border-2 border-gray-300 focus:border-purple-500 transition-colors text-base p-3"
                      disabled={isListening || isLoading}
                    />
                    <Button 
                      onClick={() => handleSendMessage()}
                      disabled={isLoading || !inputText.trim() || isListening}
                      className={`bg-gradient-to-r ${getAvatarGradient()} hover:opacity-90 text-white px-6`}
                    >
                      <Send className="w-5 h-5" />
                    </Button>
                  </div>
                </div>

                {/* Voice Input Section */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 block">
                    🎤 Or use voice input:
                  </label>
                  <div className="flex justify-center">
                    <Button
                      onClick={isListening ? stopListening : startListening}
                      variant={isListening ? "secondary" : "outline"}
                      className="px-6 py-3"
                      disabled={isLoading}
                    >
                      {isListening ? <MicOff className="w-5 h-5 mr-2" /> : <Mic className="w-5 h-5 mr-2" />}
                      {isListening ? "Stop Listening" : "Start Voice Input"}
                    </Button>
                  </div>
                </div>
              </div>

              <p className="text-xs text-gray-500 mt-3 text-center">
                {isListening ? `👂 Listening for your voice...` : 
                 isSpeaking ? `🔊 ${config.name} is speaking...` : 
                 `Choose your preferred way to communicate with ${config.name}`}
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* New Avatar Settings Panel */}
      {showAvatarSettings && (
        <AvatarSettingsPanel 
          selectedAvatar={selectedAvatar}
          setSelectedAvatar={setSelectedAvatar}
          onClose={() => setShowAvatarSettings(false)}
        />
      )}
    </motion.div>
  );
}