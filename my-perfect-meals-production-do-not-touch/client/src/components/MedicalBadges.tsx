import { useState } from "react";
import { Info } from "lucide-react";
import type { MedicalBadge } from "@/utils/medicalPersonalization";

interface MedicalBadgesProps {
  badges: MedicalBadge[];
  className?: string;
}

export default function MedicalBadges({ badges, className = "" }: MedicalBadgesProps) {
  const [hoveredBadge, setHoveredBadge] = useState<string | null>(null);
  const [touchedBadge, setTouchedBadge] = useState<string | null>(null);

  if (badges.length === 0) return null;

  // Handle touch start for mobile
  const handleTouchStart = (badgeId: string) => {
    setTouchedBadge(badgeId);
    // Auto-hide after 3 seconds on mobile
    setTimeout(() => {
      if (touchedBadge === badgeId) {
        setTouchedBadge(null);
      }
    }, 3000);
  };

  const showTooltip = (badgeId: string) => {
    return hoveredBadge === badgeId || touchedBadge === badgeId;
  };

  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {badges.map((badge) => (
        <div
          key={badge.id}
          className="relative"
          onMouseEnter={() => setHoveredBadge(badge.id)}
          onMouseLeave={() => setHoveredBadge(null)}
          onTouchStart={() => handleTouchStart(badge.id)}
          onTouchEnd={(e) => {
            e.preventDefault(); // Prevent ghost clicks
          }}
        >
          <div
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${badge.color} ${badge.textColor} cursor-help transition-all duration-200 hover:scale-105 active:scale-95 select-none`}
          >
            <Info className="w-3 h-3" />
            {badge.label}
          </div>

          {/* Enhanced Tooltip for Mobile & Desktop - Fixed z-index to appear above all content */}
          {showTooltip(badge.id) && (
            <div className="fixed inset-0 z-[100] pointer-events-none flex items-center justify-center p-4">
              <div className="pointer-events-auto bg-gray-900 text-white text-xs rounded-lg px-4 py-3 max-w-xs shadow-2xl backdrop-blur-sm border border-gray-700 animate-in fade-in-0 zoom-in-95 duration-200">
                <div className="font-medium mb-1.5">{badge.label}</div>
                <div className="text-gray-300 leading-relaxed">{badge.description}</div>
                
                {/* Mobile hint */}
                {touchedBadge === badge.id && (
                  <div className="text-gray-400 text-xs mt-2 italic text-center border-t border-gray-700 pt-2">
                    Tap anywhere to close
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
      
      {/* Mobile overlay to close tooltips */}
      {touchedBadge && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          onTouchStart={() => setTouchedBadge(null)}
        />
      )}
    </div>
  );
}