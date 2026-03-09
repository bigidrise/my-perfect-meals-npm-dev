import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Users, ArrowLeft } from "lucide-react";

export default function CoachesComingSoon() {
  const [, setLocation] = useLocation();

  return (
    <div className="flex items-center justify-center min-h-[70vh] text-white">
      <div className="bg-black/80 border border-white/20 rounded-xl p-8 max-w-md text-center">
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
            variant="outline"
            className="border-white/30 text-white/80 hover:bg-white/10"
            onClick={() => setLocation("/pricing")}
          >
            View Plans
          </Button>
        </div>
      </div>
    </div>
  );
}
