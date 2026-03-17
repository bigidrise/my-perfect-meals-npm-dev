import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, FlaskConical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import MobileHeaderGuard from "@/components/layout/MobileHeaderGuard";
import { startCheckout, IOS_BLOCK_ERROR } from "@/lib/checkout";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";

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
  const [testSubmitting, setTestSubmitting] = useState(false);
  const [coachName, setCoachName] = useState("Coach Idrise");
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [inviteCoachSlug, setInviteCoachSlug] = useState<string>("idrise");
  const [formData, setFormData] = useState({
    name: "",
    goal: "",
    struggle: "",
    commitment: false,
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (!token) return;

    setInviteToken(token);

    fetch(apiUrl(`/api/coaching/invite/${encodeURIComponent(token)}`))
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setCoachName(data.coachName);
          setInviteCoachSlug(data.coachSlug);
        }
      })
      .catch(() => {});
  }, []);

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
      coachSlug: inviteCoachSlug,
      clientEmail: user?.email || "",
      sessionId,
      inviteToken: inviteToken || undefined,
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

  const handleTestEnroll = async () => {
    if (!canContinue || testSubmitting) return;
    setTestSubmitting(true);
    try {
      const res = await fetch(apiUrl("/api/coaching/test-enroll"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ coachSlug: inviteCoachSlug }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Test enroll failed");
      toast({ title: "Test Enrollment Successful", description: "Client added to coach queue (dev bypass — no payment)." });
      setTimeout(() => setLocation("/"), 1500);
    } catch (err: any) {
      toast({ title: "Test Enroll Failed", description: err?.message, variant: "destructive" });
    } finally {
      setTestSubmitting(false);
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
        {inviteToken && (
          <div className="mb-4 bg-orange-500/20 border border-orange-400/30 rounded-xl px-4 py-3 text-sm text-orange-200 text-center">
            You were personally invited by <strong>{coachName}</strong>. Complete the form below to begin your program.
          </div>
        )}

        <div className="bg-black/40 backdrop-blur-lg border border-white/10 rounded-2xl p-6">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-white mb-2">MPM Personal Guidance</h2>
            <p className="text-white/70 text-sm">
              Work directly with {coachName}. Tell us about your goals to get started.
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

            <div className="space-y-3">
              <button
                type="submit"
                disabled={!canContinue || submitting}
                className="w-full rounded-full bg-amber-500 hover:bg-amber-600 disabled:opacity-30 disabled:cursor-not-allowed text-black font-semibold py-3 px-6 text-base transition-all active:scale-[0.98]"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Redirecting to checkout...
                  </span>
                ) : (
                  "Continue to Secure Checkout"
                )}
              </button>

              {import.meta.env.DEV && (
                <button
                  type="button"
                  onClick={handleTestEnroll}
                  disabled={!canContinue || testSubmitting}
                  className="w-full rounded-full bg-violet-700 hover:bg-violet-800 disabled:opacity-30 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  {testSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FlaskConical className="h-4 w-4" />
                  )}
                  Test Mode — Skip Payment
                </button>
              )}

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
