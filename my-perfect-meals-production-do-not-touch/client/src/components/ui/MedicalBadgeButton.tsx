
import { Eye } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes } from "react";

interface MedicalBadgeButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  title?: string;
  size?: number;
  showPulse?: boolean;
}

const MedicalBadgeButton = forwardRef<HTMLButtonElement, MedicalBadgeButtonProps>(
  ({ title = "Medical badges", className = "", size = 28, showPulse = false, ...props }, ref) => {
    return (
      <button
        ref={ref}
        title={title}
        className={`
          relative
          bg-amber-500 hover:bg-amber-600
          ${showPulse ? "border-2 border-red-500 flash-border-critical ring-2 ring-red-500 ring-offset-1" : "border-2 border-amber-300"}
          text-black rounded-xl
          flex items-center justify-center
          transition-colors
          ${className}
        `}
        style={{
          width: `${size}px`,
          height: `${size}px`
        }}
        {...props}
      >
        <Eye 
          className="text-black" 
          size={size * 0.7}
          strokeWidth={2.5}
        />
        {showPulse && (
          <span className="absolute inset-0 rounded-xl border-2 border-red-500 shadow-glow-red animate-ping pointer-events-none" />
        )}
      </button>
    );
  }
);

MedicalBadgeButton.displayName = "MedicalBadgeButton";

export default MedicalBadgeButton;
