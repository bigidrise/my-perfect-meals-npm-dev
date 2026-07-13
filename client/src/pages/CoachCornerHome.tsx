import { useLocation } from "wouter";
import { ChevronLeft } from "lucide-react";
import { PillButton } from "@/components/ui/pill-button";

interface Situation {
  id: string;
  label: string;
  path?: string;
  comingNext?: boolean;
}

const SITUATIONS: Situation[] = [
  { id: "progress_slowed", label: "My progress has slowed", path: "/coach-corner/progress-slowed" },
  { id: "tired", label: "I'm feeling tired", path: "/coach-corner/tired" },
  { id: "stressed", label: "I'm stressed", comingNext: true },
  { id: "craving", label: "I'm craving something", comingNext: true },
  { id: "eating_out", label: "I'm eating out tonight", comingNext: true },
  { id: "busy", label: "Life has gotten busy", comingNext: true },
];

export default function CoachCornerHome() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-b from-black/60 via-orange-600 to-black/80 text-white flex flex-col" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
      <div className="flex items-center px-4 pt-4 pb-2">
        <button
          onClick={() => setLocation("/dashboard")}
          className="w-9 h-9 rounded-full bg-black/40 border border-white/10 flex items-center justify-center"
        >
          <ChevronLeft className="w-5 h-5 text-white/80" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-10">
        <div className="pt-4 pb-2" />

        <div className="flex flex-col items-center mb-6 text-center">
          <img
            src="/assets/ProCareChef.png"
            alt="Chef"
            className="w-[20rem] h-auto -mb-3"
          />
          <h1 className="text-2xl font-bold italic mt-0">
            What's on your mind today?
          </h1>
        </div>

        <div className="flex flex-col gap-3">
          {SITUATIONS.map((situation) => (
            <PillButton
              key={situation.id}
              active={!situation.comingNext}
              disabled={situation.comingNext}
              onClick={() => situation.path && setLocation(situation.path)}
              className="!w-full !justify-start !text-left !text-[13px] !normal-case !py-3 !px-4 !rounded-xl disabled:opacity-40"
            >
              {situation.label}
              {situation.comingNext ? " — coming next" : ""}
            </PillButton>
          ))}
        </div>
      </div>
    </div>
  );
}
