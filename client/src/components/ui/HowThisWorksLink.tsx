import { Play } from "lucide-react";

const HOW_BUILDERS_WORK_VIDEO = "https://youtube.com/shorts/g85Pkiywrpk?feature=share";

interface HowThisWorksLinkProps {
  videoUrl?: string;
  label?: string;
  className?: string;
}

export function HowThisWorksLink({
  videoUrl = HOW_BUILDERS_WORK_VIDEO,
  label = "Builder Tutorial",
  className = "",
}: HowThisWorksLinkProps) {
  const handleClick = () => {
    window.open(videoUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className={`inline-flex flex-col items-center gap-1 ${className}`}>
      <button
        onClick={handleClick}
        aria-label={`Watch tutorial: ${label}`}
        style={{
          animation: "builderTutorialPulse 2.5s ease-in-out infinite",
        }}
        className="flex items-center justify-center w-9 h-9 rounded-full border-2 border-green-400 bg-white/5 active:scale-95 transition-transform"
      >
        <Play className="h-3.5 w-3.5 fill-green-400 text-green-400" />
        <style>{`
          @keyframes builderTutorialPulse {
            0%   { box-shadow: 0 0 0 0 rgba(74,222,128,0.6); }
            60%  { box-shadow: 0 0 0 7px rgba(74,222,128,0); }
            100% { box-shadow: 0 0 0 0 rgba(74,222,128,0); }
          }
        `}</style>
      </button>
      <span className="text-[10px] font-medium text-white/60 tracking-wide">
        {label}
      </span>
    </div>
  );
}
