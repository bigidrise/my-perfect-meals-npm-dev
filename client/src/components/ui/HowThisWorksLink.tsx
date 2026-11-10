import { Play } from "lucide-react";
import { PillButton } from "@/components/ui/pill-button";
import { getTutorialVideo, type TutorialFeature } from "@/lib/tutorialVideoRegistry";

const HOW_BUILDERS_WORK_VIDEO = "https://youtube.com/shorts/g85Pkiywrpk?feature=share";

interface HowThisWorksLinkProps {
  featureKey?: TutorialFeature;
  videoUrl?: string;
  label?: string;
  className?: string;
}

export function HowThisWorksLink({
  featureKey,
  videoUrl,
  label = "Builder Tutorial",
  className = "",
}: HowThisWorksLinkProps) {
  // Feature-keyed links never fall back to a shared video: missing links stay
  // hidden until the correct feature-specific tutorial is supplied.
  const resolvedVideoUrl = featureKey
    ? getTutorialVideo(featureKey)
    : videoUrl ?? HOW_BUILDERS_WORK_VIDEO;
  if (!resolvedVideoUrl) return null;

  const handleClick = () => {
    window.open(resolvedVideoUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className={`inline-flex flex-col items-center gap-1 ${className}`}>
      <PillButton
        active
        variant="emerald"
        onClick={handleClick}
        aria-label={`Watch tutorial: ${label}`}
        className="!h-11 !w-11 !min-h-[44px] !min-w-[44px] p-0"
      >
        <Play className="h-3 w-3 fill-white" />
      </PillButton>
      <span className="text-xs font-semibold text-white/70 tracking-wide">
        {label}
      </span>
    </div>
  );
}
