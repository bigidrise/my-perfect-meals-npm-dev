import { useLocation } from "wouter";
import { PillButton } from "@/components/ui/pill-button";

export default function CoachCornerComplete() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-b from-black/60 via-orange-600 to-black/80 text-white flex flex-col" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
      <div className="flex-1 overflow-y-auto px-4 pb-10">
        <div className="pt-14 pb-2" />

        <div className="flex flex-col items-center mb-6 text-center">
          <img
            src="/assets/ProCareChef.png"
            alt="Chef"
            className="w-[22rem] h-auto -mb-3"
          />
          <h1 className="text-2xl font-bold italic mt-0">
            You're all set.
          </h1>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/30 backdrop-blur-sm p-5 mb-6 text-sm text-white/85 leading-relaxed space-y-3">
          <p>
            Now I know a bit about how you think — what motivates you, and
            what tends to knock you off track.
          </p>
          <p>
            When you're tired, stressed, traveling, plateaued, or just craving
            dessert, Coach's Corner will use this to help guide the next best
            decision — not just the "perfect" one.
          </p>
          <p>
            I'll keep learning as we go. You can always update how I coach you
            from Coach's Corner.
          </p>
        </div>

        <div className="flex justify-center pb-6">
          <PillButton
            active
            onClick={() => setLocation("/dashboard")}
            className="!min-h-[40px] !text-xs !py-2 !px-6 !rounded-full"
          >
            Back to Dashboard
          </PillButton>
        </div>
      </div>
    </div>
  );
}
