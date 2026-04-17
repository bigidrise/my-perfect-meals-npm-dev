import { useState, useRef, useCallback } from "react";
import { Volume2, Square } from "lucide-react";
import { ttsService } from "@/lib/tts";
import type { DietClassification } from "@/components/MealClassificationPill";
import { PillButton } from "@/components/ui/pill-button";

interface KosherProTipProps {
  dietClassification?: DietClassification | null;
  isAdapted?: boolean;
}

function buildKosherScript(
  category: "meat" | "dairy" | "pareve",
  isAdapted: boolean,
): string {
  const adapted = isAdapted
    ? " This dish was adapted to meet kosher guidelines."
    : "";

  switch (category) {
    case "meat":
      return `This is a kosher meat dish. Use meat-designated cookware and do not pair it with dairy sides or desserts.${adapted}`;
    case "dairy":
      return `This is a kosher dairy dish. Use dairy-designated cookware and avoid pairing with meat.${adapted}`;
    case "pareve":
      return `This is a pareve dish. It can be served with either meat or dairy meals when prepared with neutral cookware.${adapted}`;
  }
}

export default function KosherProTip({
  dietClassification,
  isAdapted = false,
}: KosherProTipProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const category = dietClassification?.kosherCategory;
  if (!category) return null;

  const handleToggle = useCallback(async () => {
    if (isPlaying) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      ttsService.stop();
      setIsPlaying(false);
      return;
    }

    setIsPlaying(true);
    const script = buildKosherScript(category, isAdapted);

    try {
      const result = await ttsService.speak(script, {
        onStart: () => setIsPlaying(true),
        onEnd: () => setIsPlaying(false),
        onError: () => setIsPlaying(false),
      });

      if (result.audioUrl) {
        const audio = new Audio(result.audioUrl);
        audioRef.current = audio;
        audio.onended = () => {
          setIsPlaying(false);
          URL.revokeObjectURL(result.audioUrl!);
        };
        audio.onerror = () => {
          setIsPlaying(false);
          URL.revokeObjectURL(result.audioUrl!);
        };
        await audio.play();
      }
    } catch {
      setIsPlaying(false);
    }
  }, [isPlaying, category, isAdapted]);

  return (
    <PillButton
      onClick={handleToggle}
      active={isPlaying}
      variant="amber"
    >
      {isPlaying ? (
        <Square className="h-2.5 w-2.5 shrink-0 mr-1 fill-current" />
      ) : (
        <Volume2 className="h-2.5 w-2.5 shrink-0 mr-1" />
      )}
      {isPlaying ? "Stop" : "Kosher Tip"}
    </PillButton>
  );
}
