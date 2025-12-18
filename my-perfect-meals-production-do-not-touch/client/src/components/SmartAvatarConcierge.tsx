import { useState, useEffect, useRef } from "react";
import { MessageCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiUrl } from '@/lib/resolveApiBase';
// AvatarCustomization removed - will be replaced with new system
interface AvatarConfig {
  appearance: string;
  personality: string;
  voiceType: string;
  name: string;
  voiceEnabled: boolean;
}
import VoiceEnabledAvatarChat from "./VoiceEnabledAvatarChat";
import { avatarList } from "./avatarConfig";

interface AvatarConciergeProps {
  autoGreet?: boolean;
}

interface Message {
  id: string;
  text: string;
  sender: "user" | "avatar";
  timestamp: Date;
}

export default function SmartAvatarConcierge({ 
  autoGreet = false // Disabled auto-greet for development
}: AvatarConciergeProps) {
  const [isFullScreenOpen, setIsFullScreenOpen] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);
  const [currentGreeting, setCurrentGreeting] = useState("");
  const speechSynthesis = useRef<SpeechSynthesis | null>(null);
  const [location] = useLocation();
  
  // Avatar state management
  const [selectedAvatar, setSelectedAvatar] = useState(() => {
    return localStorage.getItem('selectedAvatar') || 'blackMale';
  });

  // Avatar configuration with localStorage persistence
  const [avatarConfig, setAvatarConfig] = useState<AvatarConfig>(() => {
    const saved = localStorage.getItem('avatarConfig');
    return saved ? JSON.parse(saved) : {
      appearance: "friendly",
      personality: "concierge",
      voiceType: "warm-female",
      name: "Maya",
      voiceEnabled: false
    };
  });

  // Get user data for context
  const { data: userProfile } = useQuery({ queryKey: ["/api/profile"] });
  
  // Get Avatar context for intelligent responses
  const { data: avatarContext } = useQuery({
    queryKey: ['avatar-context'],
    queryFn: async () => {
      const response = await fetch(apiUrl('/api/avatar/context'));
      return response.ok ? response.json() : {};
    },
    staleTime: 60000,
  });
  const { data: userData } = useQuery({ queryKey: ["/api/users/1"] });
  const { data: streakData } = useQuery({ queryKey: ["userStreak", 1] });
  const { data: badgeData } = useQuery({ queryKey: ["userBadges", 1] });

  // Initialize speech synthesis
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      speechSynthesis.current = window.speechSynthesis;
    }
  }, []);

  // Save avatar config to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('avatarConfig', JSON.stringify(avatarConfig));
  }, [avatarConfig]);

  // Auto-greet when component mounts
  useEffect(() => {
    if (autoGreet && !hasGreeted && userData) {
      setTimeout(() => {
        handleAutoGreeting();
        setHasGreeted(true);
      }, 3000); // Delay to let page load
    }
  }, [autoGreet, hasGreeted, userData]);

  const handleAutoGreeting = async () => {
    const context = getContextualInfo();
    const config = getPersonalityConfig();
    
    const greetingMessage = `${config.greeting} Welcome back, ${context.userName}! ${
      context.streak > 0 ? `You're on a ${context.streak}-day streak - amazing work!` : ''
    } I'm here to help you navigate the app and answer any questions. What would you like to explore today?`;

    setCurrentGreeting(greetingMessage);
    speakText(greetingMessage);
  };

  const getPersonalityConfig = () => {
    const appearances = {
      professional: "👩‍💼",
      friendly: "😊", 
      casual: "🤗",
      elegant: "✨"
    };

    const personalities = {
      chef: { name: "Chef Maya", greeting: "Welcome back to your culinary journey!" },
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

  const getContextualInfo = () => {
    const currentPage = location;
    const userName = (userData as any)?.firstName || "there";
    const streak = (streakData as any)?.currentStreak?.dayCount || 0;
    const badges = Array.isArray(badgeData) ? badgeData.length : 0;
    
    return {
      currentPage,
      userName,
      streak,
      badges,
      features: {
        weeklyMealPlanner: "Plan 7 days of meals with AI assistance",
        cravingCreator: "Generate meals based on your current cravings", 
        restaurantGuide: "Get healthy options at 50+ restaurants",
        holidayFeast: "Create special occasion meals",
        potluckPlanner: "Plan perfect potluck dishes",
        kidsHub: "Kid-friendly meal planning tools",
        healthProgress: "Track your health journey",
        shoppingList: "Smart grocery list generation"
      }
    };
  };

  const speakText = (text: string) => {
    if (!avatarConfig.voiceEnabled || !speechSynthesis.current) return;

    // Cancel any ongoing speech
    speechSynthesis.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const config = getPersonalityConfig();
    
    // Configure voice based on user selection
    const voices = speechSynthesis.current.getVoices();
    let preferredVoice;

    switch (config.voiceType) {
      case "warm-female":
        preferredVoice = voices.find(v => 
          v.lang.startsWith('en') && 
          (v.name.toLowerCase().includes('samantha') || v.name.toLowerCase().includes('susan') || v.name.toLowerCase().includes('female'))
        );
        break;
      case "professional-female":
        preferredVoice = voices.find(v => 
          v.lang.startsWith('en') && 
          (v.name.toLowerCase().includes('victoria') || v.name.toLowerCase().includes('female'))
        );
        break;
      case "friendly-male":
        preferredVoice = voices.find(v => 
          v.lang.startsWith('en') && 
          (v.name.toLowerCase().includes('daniel') || v.name.toLowerCase().includes('male')) &&
          !v.name.toLowerCase().includes('female')
        );
        break;
      case "calm-male":
        preferredVoice = voices.find(v => 
          v.lang.startsWith('en') && 
          (v.name.toLowerCase().includes('alex') || v.name.toLowerCase().includes('male')) &&
          !v.name.toLowerCase().includes('female')
        );
        break;
      default:
        preferredVoice = voices.find(voice => voice.lang.startsWith('en'));
    }

    if (!preferredVoice) {
      preferredVoice = voices.find(voice => voice.lang.startsWith('en')) || voices[0];
    }
    
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 0.8;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = (error) => {
      console.log("Speech synthesis error:", error);
      setIsSpeaking(false);
    };

    try {
      speechSynthesis.current.speak(utterance);
    } catch (error) {
      console.log("Speech synthesis failed:", error);
      setIsSpeaking(false);
    }
  };



  return (
    <div className="fixed bottom-24 right-4 z-40">
      {/* New Avatar Chef System */}
      <div className="flex flex-col gap-2 mb-3">
        {/* Avatar Selector Button */}
        <div 
          className="w-16 h-16 rounded-full flex items-center justify-center cursor-pointer shadow-lg border-3 border-orange-300 hover:scale-110 transition-all duration-200 overflow-hidden"
          onClick={() => setIsFullScreenOpen(true)}
          title="Chat with Your Personal Chef"
        >
          <img
            src={avatarList[selectedAvatar]?.image || avatarList.blackMale.image}
            alt="Chef Avatar"
            className="w-full h-full object-cover rounded-full"
          />
        </div>
      </div>

      {/* Voice-Enabled Full Screen Chat */}
      <VoiceEnabledAvatarChat
        isOpen={isFullScreenOpen}
        onClose={() => setIsFullScreenOpen(false)}
        avatarConfig={avatarConfig}
        onAvatarConfigChange={setAvatarConfig}
        selectedAvatar={selectedAvatar}
        setSelectedAvatar={setSelectedAvatar}
      />
    </div>
  );
}