import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Play, Pause } from "lucide-react";
import { voiceManager } from "@/voice/VoiceManager";
import { PillButton } from "@/components/ui/pill-button";

const CHEF_SCRIPT = `Welcome to Coach's Corner.

This isn't a check-in form. It's the start of an ongoing relationship with me — your AI coach.

Life interrupts the plan. You'll get stressed, travel, have a rough week, or just want dessert. My job isn't to judge that. It's to understand it, and help you make the next best decision based on you.

I'm going to ask you a few quick questions so I can learn how you think, what motivates you, and what tends to knock you off track. There are no wrong answers — just be honest.

When you're ready, let's get started.`;

export default function CoachCornerWelcome() {
  const [, setLocation] = useLocation();
  const [isPlaying, setIsPlaying] = useState(false);
  const voiceRef = useRef<boolean>(false);

  useEffect(() => {
    return () => {
      if (voiceRef.current) {
        voiceManager.stop();
        voiceRef.current = false;
      }
    };
  }, []);

  const toggleVoice = async () => {
    if (isPlaying) {
      voiceManager.stop();
      voiceRef.current = false;
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      voiceRef.current = true;
      await voiceManager.preload();
      const result = await voiceManager.speak(CHEF_SCRIPT, () => {
        setIsPlaying(false);
        voiceRef.current = false;
      });
      if (result.status !== "playing") {
        setIsPlaying(false);
        voiceRef.current = false;
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-black/60 via-orange-600 to-black/80 text-white flex flex-col">
      <div className="flex-1 overflow-y-auto px-4 pb-40">
        <div className="pt-10 pb-2" />

        <div className="flex flex-col items-center mb-4 -mt-2">
          <img
            src="/assets/ProCareChef.png"
            alt="Chef"
            className="w-[24rem] h-auto -mb-3"
          />
          <h1 className="text-2xl font-bold italic mt-0 text-center">
            Coach's Corner
          </h1>
          <p className="text-white/70 text-sm leading-relaxed text-center mt-1 max-w-xs">
            Your AI coaching relationship starts here.
          </p>
        </div>

        <div className="mb-6">
          <button
            onClick={toggleVoice}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-black/40 border border-orange-400/30 active:scale-[0.98] transition-transform ${!isPlaying ? "animate-pulse" : ""}`}
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center ${isPlaying ? "bg-red-500/20 border border-red-400/30" : "bg-orange-500/20 border border-orange-400/30"}`}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 text-red-400" />
              ) : (
                <Play className="w-5 h-5 text-orange-300 ml-0.5" />
              )}
            </div>
            <div className="text-left flex-1">
              <p className="text-sm font-medium text-white">
                {isPlaying ? "Listening to Chef..." : "Hear from Chef"}
              </p>
              <p className="text-xs text-white/60">
                {isPlaying ? "Tap to stop" : "A quick intro to Coach's Corner"}
              </p>
            </div>
          </button>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/30 backdrop-blur-sm p-5 mb-6 whitespace-pre-line text-sm text-white/80 leading-relaxed">
          {CHEF_SCRIPT}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/95 to-transparent">
        <PillButton
          active
          onClick={() => setLocation("/coach-corner/intake")}
          className="w-full !min-h-[52px] !text-sm !py-3 !rounded-2xl"
        >
          Start My Coach Intake
        </PillButton>
      </div>
    </div>
  );
}
