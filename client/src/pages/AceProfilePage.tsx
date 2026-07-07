import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import CoachingProfileSetup from "@/components/ace/CoachingProfileSetup";
import { useCoachingProfile } from "@/hooks/useCoachingProfile";

export default function AceProfilePage() {
  const [, setLocation] = useLocation();
  const { data: profile, isLoading } = useCoachingProfile();

  return (
    <div className="min-h-screen bg-gradient-to-b from-black/60 via-orange-600 to-black/80">
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <button
            type="button"
            onClick={() => setLocation("/dashboard")}
            className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">Coaching Profile</h1>
            <p className="text-sm text-white/60">
              {isLoading
                ? "Loading..."
                : profile
                ? "Update your coaching preferences"
                : "Set up your coaching preferences"}
            </p>
          </div>
        </div>

        <div className="bg-black/30 rounded-2xl p-6 border border-white/10">
          <CoachingProfileSetup onComplete={() => setLocation("/dashboard")} />
        </div>

        <p className="text-center text-white/40 text-xs mt-6">
          Your coaching profile helps personalize recommendations. It is never
          shared with third parties.
        </p>
      </div>
    </div>
  );
}
