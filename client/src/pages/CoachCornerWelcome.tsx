import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Play, Pause } from "lucide-react";
import { voiceManager } from "@/voice/VoiceManager";
import { PillButton } from "@/components/ui/pill-button";

const CHEF_SCRIPT = `Hi, I'm Chef. Welcome to Coach's Corner.

No matter how much we read, how many videos we watch, or how much we think we know about nutrition, there are still moments when we're just not sure what to do.

Maybe you're tired.

Maybe you've hit a plateau.

Maybe you're craving something sweet.

Maybe you're eating out tonight.

Maybe life has simply gotten busy.

Those are the moments Coach's Corner was built for.

My job isn't to replace your meal plan. My job is to help you make better decisions when real life gets in the way.

To do that, I need to understand you.

The next few questions aren't about building another nutrition plan. My Perfect Meals already does that.

These questions help me understand how you make decisions, what motivates you, how you respond to setbacks, and how I can coach you in a way that's most helpful for you.

There are no right or wrong answers.

Just answer honestly.

The better I understand you, the more personal my coaching becomes.

After we finish, Coach's Corner will be here whenever you need it.

Whether you're feeling tired...

Wondering why your progress has slowed...

Trying to make a better restaurant choice...

Need help with cravings...

Have questions about supplements or nutrition...

Or simply aren't sure what to do next...

You don't have to figure it out alone.

I'll help you make the next best decision based on you.

Whenever you're ready...

Let's get started.`;

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
            Hi, I'm Chef.
          </h1>
          <p className="text-white/70 text-sm leading-relaxed text-center mt-1 max-w-xs">
            Welcome to Coach's Corner.
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
