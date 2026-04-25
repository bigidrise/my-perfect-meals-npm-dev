import { Play } from "lucide-react";
import { PillButton } from "@/components/ui/pill-button";

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
      <PillButton
        active
        variant="emerald"
        onClick={handleClick}
        aria-label={`Watch tutorial: ${label}`}
        className="px-3"
      >
        <Play className="h-3 w-3 fill-white" />
      </PillButton>
      <span className="text-xs font-semibold text-white/70 tracking-wide">
        {label}
      </span>
    </div>
  );
}
