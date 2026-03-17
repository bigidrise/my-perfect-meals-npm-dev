import { useState } from "react";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import MobileHeaderGuard from "@/components/layout/MobileHeaderGuard";
import { startCheckout, IOS_BLOCK_ERROR } from "@/lib/checkout";

function getCurrentUser() {
  try {
    const raw = localStorage.getItem("mpm_current_user") || localStorage.getItem("user");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default function ApplyGuidance() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    goal: "",
    struggle: "",
    commitment: false,
  });

  const canContinue =
    formData.name.trim() !== "" &&
    formData.goal.trim() !== "" &&
    formData.struggle.trim() !== "" &&
    formData.commitment;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canContinue || submitting) return;

    const user = getCurrentUser();
    const sessionId = crypto.randomUUID();

    sessionStorage.setItem("mpm_pending_coach", JSON.stringify({
      coachSlug: "idrise",
      clientEmail: user?.email || "",
      sessionId,
      ts: Date.now(),
    }));

    setSubmitting(true);
    try {
      await startCheckout("mpm_guidance", { context: "coaching" });
    } catch (err: any) {
      sessionStorage.removeItem("mpm_pending_coach");
      if (err?.code === IOS_BLOCK_ERROR) {
        toast({
          title: "Use Browser for Checkout",
          description: "Please open this page in Safari or Chrome to complete your purchase.",
        });
      } else {
        toast({
          title: "Something went wrong",
          description: err?.message || "Please try again.",
          variant: "destructive",
        });
      }
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-20">
      <MobileHeaderGuard>
        <div
          className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="px-4 py-3 flex items-center gap-3">
            <button
              onClick={() => setLocation("/pricing")}
              className="flex items-center text-white hover:bg-white/10 transition-all duration-200 p-2 rounded-lg"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-lg font-bold text-white">Start Personal Guidance</h1>
          </div>
        </div>
      </MobileHeaderGuard>

      <div
        className="max-w-2xl mx-auto px-4 pb-12"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
      >
        <div className="bg-black/40 backdrop-blur-lg border border-white/10 rounded-2xl p-6">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-white mb-2">MPM Personal Guidance</h2>
            <p className="text-white/70 text-sm">
              Work directly with the founder of My Perfect Meals.
              Tell us about your goals to get started.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-white/90">Full Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="bg-white/5 border-white/20 text-white placeholder:text-white/40"
                placeholder="Your full name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="goal" className="text-white/90">Primary Goal with My Perfect Meals</Label>
              <Textarea
                id="goal"
                value={formData.goal}
                onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
                required
                className="bg-white/5 border-white/20 text-white placeholder:text-white/40 min-h-[100px]"
                placeholder="What are you hoping to achieve?"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="struggle" className="text-white/90">Biggest Current Struggle / Nutrition Challenge</Label>
              <Textarea
                id="struggle"
                value={formData.struggle}
                onChange={(e) => setFormData({ ...formData, struggle: e.target.value })}
                required
                className="bg-white/5 border-white/20 text-white placeholder:text-white/40 min-h-[100px]"
                placeholder="What's been holding you back?"
              />
            </div>

            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="commitment"
                checked={formData.commitment}
                onChange={(e) => setFormData({ ...formData, commitment: e.target.checked })}
                required
                className="mt-1 accent-amber-500"
              />
              <Label htmlFor="commitment" className="text-white/80 text-sm leading-relaxed cursor-pointer">
                I confirm a 6-month commitment and understand this is async, in-app guidance only.
                No video calls. No off-platform contact.
              </Label>
            </div>

            <div className="space-y-2">
              <Button
                type="submit"
                size="lg"
                disabled={!canContinue || submitting}
                className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:opacity-30 disabled:cursor-not-allowed text-black font-semibold"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Redirecting to checkout...
                  </>
                ) : (
                  "Continue to Secure Checkout"
                )}
              </Button>
              <p className="text-xs text-center text-white/40">
                You will not be charged until your coach activates your program.
              </p>
              <p className="text-xs text-center text-white/30">
                Your coach will contact you within 24 hours after activation.
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
