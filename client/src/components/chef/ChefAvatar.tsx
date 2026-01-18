import clsx from "clsx";
import { VoiceState } from "@/voice/VoiceSessionController";

type Props = {
  voiceState: VoiceState;
};

export default function ChefAvatar({ voiceState }: Props) {
  return (
    <div className="chef-avatar-container flex items-center justify-center">
      <div
        className={clsx(
          "chef-avatar w-[120px] h-[120px] rounded-full transition-all duration-300",
          "bg-gradient-radial from-amber-400 to-orange-500",
          {
            "opacity-60": voiceState === "idle",
            "animate-pulse": voiceState === "listening",
            "shadow-[0_0_12px_rgba(255,183,3,0.6)]": voiceState === "thinking",
            "animate-talk shadow-[0_0_18px_rgba(255,120,0,1)]": voiceState === "speaking",
          }
        )}
        style={{
          background: "radial-gradient(circle, #ffb703, #fb8500)",
        }}
      />
    </div>
  );
}
