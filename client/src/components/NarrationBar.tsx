import { useState, useCallback } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  FileText,
  Undo2,
  ChevronRight,
} from "lucide-react";
import { PillButton } from "@/components/ui/pill-button";
import { useNarration } from "@/hooks/useNarration";

interface NarrationSection {
  heading: string;
  text?: string;
  list?: string[];
  [key: string]: unknown;
}

interface NarrationBarProps {
  sections: NarrationSection[];
  onSectionChange?: (index: number) => void;
  className?: string;
  speedOverride?: string;
}

export function NarrationBar({
  sections,
  onSectionChange,
  className = "",
  speedOverride,
}: NarrationBarProps) {
  const [hasStarted, setHasStarted] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

  const {
    isPlaying,
    isPaused,
    currentSectionIndex,
    totalSections,
    play,
    pause,
    resume,
    stop,
    reset,
    skipBack10,
    nextSection,
  } = useNarration(sections, {
    onSectionChange,
    onEnd: () => setHasStarted(false),
    speedOverride,
  });

  const handleListen = () => {
    setHasStarted(true);
    play();
  };

  const handleStop = () => {
    stop();
    setHasStarted(false);
    setShowTranscript(false);
  };

  const handleStartOver = useCallback(() => {
    reset();
    setHasStarted(true);
    setTimeout(() => play(), 50);
  }, [reset, play]);

  const currentSection = sections[currentSectionIndex];

  if (!hasStarted) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <PillButton onClick={handleListen} className="flex items-center gap-1.5">
          <Play className="h-3.5 w-3.5" />
          Listen
        </PillButton>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-white/40 font-mono tabular-nums shrink-0">
          {currentSectionIndex + 1}/{totalSections}
        </span>

        {isPlaying ? (
          <PillButton onClick={pause} active className="flex items-center gap-1.5">
            <Pause className="h-3.5 w-3.5" />
            Pause
          </PillButton>
        ) : isPaused ? (
          <PillButton onClick={resume} className="flex items-center gap-1.5">
            <Play className="h-3.5 w-3.5" />
            Resume
          </PillButton>
        ) : (
          <PillButton onClick={play} className="flex items-center gap-1.5">
            <Play className="h-3.5 w-3.5" />
            Play
          </PillButton>
        )}

        <PillButton onClick={skipBack10} className="flex items-center gap-1.5">
          <Undo2 className="h-3.5 w-3.5" />
          10s Back
        </PillButton>

        <PillButton onClick={nextSection} className="flex items-center gap-1.5">
          <ChevronRight className="h-3.5 w-3.5" />
          Next
        </PillButton>

        <PillButton onClick={handleStartOver} className="flex items-center gap-1.5">
          <RotateCcw className="h-3.5 w-3.5" />
          Start Over
        </PillButton>

        <PillButton
          onClick={() => setShowTranscript((v) => !v)}
          active={showTranscript}
          className="flex items-center gap-1.5"
        >
          <FileText className="h-3.5 w-3.5" />
          {showTranscript ? "Hide" : "Transcript"}
        </PillButton>

        <PillButton
          onClick={handleStop}
          className="flex items-center gap-1.5 opacity-60"
        >
          Stop
        </PillButton>
      </div>

      {showTranscript && currentSection && (
        <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1.5">
          <p className="text-xs font-semibold text-orange-400 uppercase tracking-wider">
            {currentSection.heading}
          </p>
          {currentSection.text && (
            <p className="text-xs text-white/70 leading-relaxed">
              {String(currentSection.text)}
            </p>
          )}
          {Array.isArray(currentSection.list) && (
            <ul className="space-y-1 mt-1">
              {(currentSection.list as string[]).map((item, i) => (
                <li key={i} className="text-xs text-white/70 flex items-start gap-2">
                  <span className="text-white/30 mt-0.5">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
