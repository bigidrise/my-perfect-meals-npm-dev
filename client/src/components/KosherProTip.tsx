import { useState, useRef, useCallback } from "react";
import { ShieldAlert } from "lucide-react";
import { ttsService } from "@/lib/tts";
import type { DietClassification } from "@/components/MealClassificationPill";

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
    <button
      onClick={handleToggle}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-medium whitespace-nowrap transition-all active:scale-[0.97] ${
        isPlaying
          ? "bg-amber-500/25 border-amber-400/60 text-amber-300"
          : "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
      }`}
    >
      <ShieldAlert className="h-3 w-3 shrink-0" />
      {isPlaying ? "Stop" : "Kosher Tip"}
    </button>
  );
}
