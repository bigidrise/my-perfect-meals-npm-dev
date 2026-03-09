import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Users, ArrowLeft } from "lucide-react";

export default function CoachesComingSoon() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 flex items-center justify-center text-white px-4">
      <div className="bg-black/80 backdrop-blur-2xl border border-white/15 rounded-xl p-8 max-w-md w-full text-center shadow-2xl">
        <div className="w-14 h-14 bg-orange-600/20 rounded-full flex items-center justify-center mx-auto mb-5">
          <Users className="h-7 w-7 text-orange-400" />
        </div>

        <h1 className="text-2xl font-bold mb-3">Find a Coach</h1>

        <p className="text-white/80 mb-4">
          The My Perfect Meals coach marketplace is coming soon.
        </p>

        <p className="text-white/60 text-sm mb-6">
          Soon you'll be able to connect with certified trainers,
          physicians, and nutrition professionals directly inside the app.
        </p>

        <div className="flex gap-3 justify-center">
          <Button
            onClick={() => setLocation("/dashboard")}
            className="bg-orange-600 hover:bg-orange-500 text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>

          <Button
            onClick={() => setLocation("/pricing")}
            className="bg-white/10 text-white border border-white/20"
          >
            View Plans
          </Button>
        </div>
      </div>
    </div>
  );
}
