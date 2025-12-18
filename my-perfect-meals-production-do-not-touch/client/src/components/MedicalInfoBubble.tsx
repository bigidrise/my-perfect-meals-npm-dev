import { useState, useRef, useEffect } from 'react';
import { HeartPulse, X, Shield, Plus } from 'lucide-react';

const CRITICAL_BADGE_LABEL_MATCHES = [
  "cardiac",
  "heart",
  "heart-healthy",
  "low sodium",
  "renal",
  "kidney",
  "glp-1",
  "glp1",
  "diabetes",
  "diabetic",
];

interface MedicalBadge {
  id: string;
  label: string;
  description: string;
}

interface MedicalInfoBubbleProps {
  badges: MedicalBadge[];
  description?: string;
}

export default function MedicalInfoBubble({ badges, description }: MedicalInfoBubbleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // If no badges, don't render anything
  if (!badges || badges.length === 0) return null;

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Auto-generate description if not provided
  const autoDescription = description || 
    "This recipe supports your health goals and dietary needs.";

  const isCriticalBadge = (label: string) => 
    CRITICAL_BADGE_LABEL_MATCHES.some(match => label.toLowerCase().includes(match));

  return (
    <div className="relative inline-block" ref={popoverRef}>
      {/* Info Icon Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="bg-lime-700 hover:bg-lime-800 border-2 border-lime-600 text-white rounded-xl w-5 h-5 flex items-center justify-center text-sm font-bold"
        aria-label="View health and medical tags"
        data-testid="button-medical-info"
      >
        ?
      </button>

      {/* Popover */}
      {isOpen && (
        <div 
          className="absolute z-50 right-0 top-9 w-72 bg-black/30 text-white rounded-2xl shadow-2xl backdrop-blur-lg border border-white/20 p-4 animate-fadeIn"
          onClick={(e) => e.stopPropagation()}
          data-testid="popover-medical-info"
        >
          {/* Header with close button */}
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-purple-300 flex items-center gap-2">
              <HeartPulse className="w-4 h-4" />
              Health & Medical Tags
            </h4>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white/60 hover:text-white/90 transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Description */}
          <p className="text-xs text-white/70 mb-3 leading-relaxed">
            {autoDescription}
          </p>

          {/* Badge List */}
          <div className="flex flex-wrap gap-2">
            {badges.map((badge) => (
              <span
                key={badge.id}
                className={`px-3 py-1.5 text-xs rounded-full border border-white/20 transition-colors 
                  ${isCriticalBadge(badge.label) 
                    ? 'bg-red-500/20 hover:bg-red-500/30 animate-pulse' 
                    : 'bg-white/10 hover:bg-white/15'}`
                }
                title={badge.description || badge.label}
              >
                {badge.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}