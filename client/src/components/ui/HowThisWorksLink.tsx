import { Play } from "lucide-react";

interface HowThisWorksLinkProps {
  videoUrl: string;
  label?: string;
  className?: string;
}

/**
 * HowThisWorksLink
 *
 * A small, subtle pill button that opens a tutorial video in a new tab.
 * Placed just below the page title in each builder.
 * Non-intrusive — visible but never dominant.
 */
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
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-white/20 bg-white/5 hover:bg-white/10 transition-colors text-xs text-white/60 hover:text-white/80 ${className}`}
      aria-label={`Watch tutorial: ${label}`}
    >
      <Play className="h-3 w-3 fill-current" />
      <span>{label}</span>
    </button>
  );
}
