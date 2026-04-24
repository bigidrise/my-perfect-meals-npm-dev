import { Play } from "lucide-react";

interface HowThisWorksLinkProps {
  videoUrl: string;
  label?: string;
  className?: string;
}

export function HowThisWorksLink({
  videoUrl,
  label = "How this works",
  className = "",
}: HowThisWorksLinkProps) {
  const handleClick = () => {
    window.open(videoUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <button
      onClick={handleClick}
      className={`relative inline-flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm text-white transition-all active:scale-95 ${className}`}
      style={{
        background: "linear-gradient(135deg, #f97316, #ea580c)",
        boxShadow: "0 0 0 0 rgba(249,115,22,0.7)",
        animation: "howItWorksPulse 2s ease-in-out infinite",
      }}
      aria-label={`Watch tutorial: ${label}`}
    >
      <Play className="h-3.5 w-3.5 fill-white flex-shrink-0" />
      <span>{label}</span>
      <style>{`
        @keyframes howItWorksPulse {
          0%   { box-shadow: 0 0 0 0 rgba(249,115,22,0.7); }
          60%  { box-shadow: 0 0 0 8px rgba(249,115,22,0); }
          100% { box-shadow: 0 0 0 0 rgba(249,115,22,0); }
        }
      `}</style>
    </button>
  );
}
