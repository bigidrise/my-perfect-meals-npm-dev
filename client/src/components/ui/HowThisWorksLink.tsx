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
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/10 bg-gradient-to-r from-white/10 to-white/5 hover:from-white/15 hover:to-white/10 transition-colors text-xs font-medium text-white/90 hover:text-white ${className}`}
      aria-label={`Watch tutorial: ${label}`}
    >
      <Play className="h-3 w-3 fill-current" />
      <span>{label}</span>
    </button>
  );
}
