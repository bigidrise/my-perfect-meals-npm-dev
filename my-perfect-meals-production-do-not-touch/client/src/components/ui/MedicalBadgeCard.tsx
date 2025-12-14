
import { X, HeartPulse } from "lucide-react";

interface MedicalBadge {
  label: string;
  description?: string;
  isCritical?: boolean;
}

interface MedicalBadgeCardProps {
  badges: MedicalBadge[];
  onClose: () => void;
  title?: string;
  description?: string;
  className?: string;
}

export default function MedicalBadgeCard({
  badges,
  onClose,
  title = "Health & Medical Tags",
  description,
  className = ""
}: MedicalBadgeCardProps) {
  return (
    <div 
      className={`
        absolute z-50 right-0 top-9 w-72 
        bg-black/30 text-white rounded-2xl 
        shadow-2xl backdrop-blur-xl 
        border border-white/20 p-4 
        animate-fadeIn
        ${className}
      `}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-amber-300 flex items-center gap-2">
          <HeartPulse className="w-4 h-4" />
          {title}
        </h4>
        <button
          onClick={onClose}
          className="text-white/60 hover:text-white/90 transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {description && (
        <p className="text-xs text-white/70 mb-3 leading-relaxed">
          {description}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {badges.map((badge, index) => (
          <span
            key={index}
            className={`px-3 py-1.5 text-xs rounded-full border border-white/20 transition-colors 
              ${badge.isCritical 
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
  );
}
