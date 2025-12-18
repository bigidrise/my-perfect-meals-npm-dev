import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface AvatarSpeechBubbleProps {
  text: string;
  visible: boolean;
  onClose?: () => void;
}

export const AvatarSpeechBubble = ({ text, visible, onClose }: AvatarSpeechBubbleProps) => {
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  useEffect(() => {
    if (!visible && !isAnimatingOut) {
      setIsAnimatingOut(false);
    }
  }, [visible, isAnimatingOut]);

  const handleClose = () => {
    if (onClose) {
      setIsAnimatingOut(true);
      setTimeout(() => {
        onClose();
        setIsAnimatingOut(false);
      }, 300);
    }
  };

  if (!visible && !isAnimatingOut) return null;

  return (
    <div 
      className={`fixed bottom-20 sm:bottom-24 right-4 max-w-xs sm:max-w-sm z-40 transition-all duration-300 transform ${
        visible && !isAnimatingOut 
          ? 'opacity-100 translate-y-0 scale-100' 
          : 'opacity-0 translate-y-4 scale-95'
      }`}
    >
      <div className="bg-white/95 backdrop-blur-sm border-2 border-purple-500/30 rounded-2xl shadow-xl p-4 relative">
        {/* Speech bubble arrow pointing to avatar */}
        <div className="absolute bottom-[-8px] right-6 w-4 h-4 bg-white/95 border-r-2 border-b-2 border-purple-500/30 transform rotate-45"></div>
        
        {/* Close button */}
        {onClose && (
          <button
            onClick={handleClose}
            className="absolute top-2 right-2 w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
            aria-label="Close speech bubble"
          >
            <X size={12} className="text-gray-600" />
          </button>
        )}
        
        {/* Avatar indicator */}
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
            <span className="text-white text-xs font-bold">👨‍🍳</span>
          </div>
          <span className="text-xs font-semibold text-purple-600">Chef Says:</span>
        </div>
        
        {/* Speech text */}
        <p className="text-sm text-gray-800 leading-relaxed pr-4">
          {text}
        </p>
        
        {/* Accessibility indicator */}
        <div className="mt-2 pt-2 border-t border-gray-200">
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <span role="img" aria-label="accessibility">♿</span>
            Speech-to-text enabled
          </span>
        </div>
      </div>
    </div>
  );
};

export default AvatarSpeechBubble;